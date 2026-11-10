// Strike Neon — Google Play Billing (Kotlin, reference implementation)
//
// Corrige o erro "Play Connection": o BillingClient passa a ter um listener
// de estado de conexão, reconexão automática com backoff, e a consulta de
// produtos (queryProductDetailsAsync) só acontece DEPOIS de
// onBillingSetupFinished reportar OK.
//
// Cole este ficheiro em android/app/src/main/java/com/sarfen1/strikeneon/
// e ligue-o à WebView bridge (window.StrikeNeonNative), conforme o contrato
// em ANDROID.md.

package com.sarfen1.strikeneon

import android.app.Activity
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.android.billingclient.api.AccountIdentifiers
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams

/**
 * IDs exatos dos produtos no Play Console — têm de coincidir letra por letra.
 */
private val SHARD_PRODUCT_IDS = listOf("shards_500", "shards_1000", "shards_2500", "shards_weekly_090")

/**
 * Gestor do BillingClient com:
 *  1. listener de conexão (onBillingSetupFinished),
 *  2. reconexão automática (startConnection) com backoff exponencial,
 *  3. queryProductDetailsAsync APENAS depois da conexão confirmada.
 */
class BillingManager(
    private val activity: Activity,
    private val webView: WebView,
) : PurchasesUpdatedListener {

    private var billingClient: BillingClient? = null
    private var playConnected = false

    private val retryHandler = Handler(Looper.getMainLooper())
    private var retryAttempt = 0
    private val maxRetryAttempts = 5
    private val retryDelaysMs = longArrayOf(1_000, 2_000, 4_000, 8_000, 15_000)

    private fun buildClient(): BillingClient =
        BillingClient.newBuilder(activity)
            .setListener(this) // onPurchasesUpdated — sheet do Play
            .enablePendingPurchases()
            .build()

    /**
     * Ponto de entrada da conexão. Chamado no onCreate e também pela bridge
     * JS (window.StrikeNeonNative.connectBilling()) quando o jogo tenta
     * reconectar.
     */
    fun connectToPlayBilling() {
        if (playConnected) {
            // Já ligado: confirma logo ao JS e re-responde o catálogo.
            fireBillingReady(cachedProducts)
            return
        }
        if (billingClient == null) billingClient = buildClient()
        retryAttempt = 0
        billingClient?.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(billingResult: BillingResult) {
                when (billingResult.responseCode) {
                    BillingClient.BillingResponseCode.OK -> {
                        playConnected = true
                        retryAttempt = 0
                        // (3) SÓ AQUI — conexão confirmada — se consulta produtos.
                        queryShardProducts()
                    }
                    // Erros transitórios de conexão à Play Store: tentar de novo.
                    BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE,
                    BillingClient.BillingResponseCode.SERVICE_TIMEOUT,
                    BillingClient.BillingResponseCode.SERVICE_DISCONNECTED,
                    BillingClient.BillingResponseCode.ERROR -> scheduleReconnect()
                    // Erros de configuração (app não publicado, licenças): não
                    // adianta reconectar — reporta para o log / console.
                    else -> fireBillingUnavailable(billingResult.responseCode)
                }
            }

            override fun onBillingServiceDisconnected() {
                // (2) Serviço caiu (Play Store atualizando, rede instável...):
                // reconectar automaticamente.
                playConnected = false
                scheduleReconnect()
            }
        })
    }

    /** Reconexão automática com backoff, chamada de volta em startConnection. */
    private fun scheduleReconnect() {
        if (retryAttempt >= maxRetryAttempts) {
            fireBillingUnavailable(-1) // esgotou as tentativas; JS mostra RETRY
            return
        }
        val delay = retryDelaysMs[retryAttempt.coerceIn(0, retryDelaysMs.size - 1)]
        retryAttempt++
        retryHandler.postDelayed({ connectToPlayBilling() }, delay)
    }

    /**
     * Consulta dos produtos. NUNCA chamar antes de onBillingSetupFinished == OK,
     * senão devolve DEVELOPER_ERROR / não faz nada e os botões ficam cinzentos.
     */
    private var cachedProducts: List<ProductDetails> = emptyList()

    private fun queryShardProducts() {
        val client = billingClient ?: return
        if (!client.isReady) {
            scheduleReconnect()
            return
        }
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(
                SHARD_PRODUCT_IDS.map { id ->
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(id)
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build()
                }
            )
            .build()
        client.queryProductDetailsAsync(params) { billingResult, productDetailsList ->
            if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                cachedProducts = productDetailsList
                fireBillingReady(productDetailsList)
            } else {
                // Catálogo falhou mesmo com conexão OK — o jogo continua com os
                // preços locais de fallback e os botões ativos.
                fireBillingUnavailable(billingResult.responseCode)
            }
        }
    }

    private fun fireBillingReady(products: List<ProductDetails>) {
        val json = products.joinToString(",") { p ->
            """{"productId":"${p.productId}","title":"${p.name ?: ""}","price":"${p.oneTimePurchaseOfferDetails?.formattedPrice ?: ""}"}"""
        }
        webView.post {
            webView.evaluateJavascript(
                "window.StrikeNeonOnBillingReady && window.StrikeNeonOnBillingReady({products:[$json]});",
                null,
            )
        }
    }

    private fun fireBillingUnavailable(responseCode: Int) {
        webView.post {
            webView.evaluateJavascript(
                "window.StrikeNeonOnPurchaseFailed && window.StrikeNeonOnPurchaseFailed({reason:'PLAY_CONNECTION',code:$responseCode});",
                null,
            )
        }
    }

    /** Chamado pela WebView bridge quando o JS pede reconnect (botão RETRY). */
    @JavascriptInterface
    fun connectBilling() {
        activity.runOnUiThread { connectToPlayBilling() }
    }

    /** Fluxo de compra (resumo — contrato completo em ANDROID.md). */
    @JavascriptInterface
    fun buyShards(productId: String) {
        // sheet do Play → onPurchasesUpdated → PURCHASED → consumeAsync →
        // window.StrikeNeonOnPurchaseSuccess
    }

    override fun onPurchasesUpdated(billingResult: BillingResult, purchases: MutableList<Purchase>?) {
        // (contrato em ANDROID.md: PURCHASED → consumeAsync → StrikeNeonOnPurchaseSuccess)
    }
}

// Fragmento de wiring (MainActivity):
//
//   webView.addJavascriptInterface(BillingManager(this, webView), "StrikeNeonNativeBridge")
//   webView.webViewClient = object : WebViewClient() {
//       override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
//           view.evaluateJavascript(
//               "window.StrikeNeonNative = window.StrikeNeonNativeBridge; void 0;", null)
//       }
//   }
//   billingManager.connectToPlayBilling()   // primeira conexão no arranque
//
// A bridge exposta ao JS precisa, no mínimo: buyShards, connectBilling,
// queryProducts, restorePurchases (ver NativeBridge em src/game/billing.ts).

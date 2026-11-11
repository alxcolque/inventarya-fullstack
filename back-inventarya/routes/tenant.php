<?php

declare(strict_types=1);

use App\Http\Controllers\Api\DeviceTokenController;
/*
|--------------------------------------------------------------------------
| Tenant Routes
|--------------------------------------------------------------------------
|
| Here you can register the tenant routes for your application.
| These routes are loaded by the TenantRouteServiceProvider.
|
| Feel free to customize them however you want. Good luck!
|
*/

use App\Http\Controllers\AssignmentController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\InvitationActivationController;
use App\Http\Controllers\BackupController;
use App\Http\Controllers\BrandController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\ExternalStoreProductController;
use App\Http\Controllers\InventoryStoreController;
use App\Http\Controllers\InventoryWarehouseController;
use App\Http\Controllers\LocationController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\NotificationManagementController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ProductImageController;
use App\Http\Controllers\SaleController;
use App\Http\Controllers\SaleDetailController;
use App\Http\Controllers\SaleRefundController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\StockMovementController;
use App\Http\Controllers\StoreController;
use App\Http\Controllers\SiatController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\TenantDashboardController;
use App\Http\Controllers\TenantPlanController;
use App\Http\Controllers\UserController;
use App\Http\Middleware\CheckRole;
use App\Http\Middleware\InitializeTenancyFlexible;
use App\Http\Middleware\VerifyStoreApiKey;
use Illuminate\Support\Facades\Route;

Route::middleware([
    'api',
    InitializeTenancyFlexible::class,
])->prefix('api')->group(function () {
    Route::get('/', function () {
        return 'This is your multi-tenant application API. Tenant ID: '.tenant('id');
    });

    Route::get('/ping', function () {
        return response()->json(['ok' => true, 'status' => 'ok', 'online' => true, 'timestamp' => now()], 200);
    });
    Route::post('/auth/login', [AuthController::class, 'login']);
    Route::get('/system-data', [SettingController::class, 'getSystemData']);
    Route::middleware('throttle:10,1')->prefix('account-invitations')->group(function () {
        Route::post('/validate', [InvitationActivationController::class, 'show']);
        Route::post('/activate', [InvitationActivationController::class, 'store']);
    });

    Route::middleware('throttle:10,1')->prefix('account-deletion')->group(function () {
        Route::post('/public-request', [\App\Http\Controllers\AccountDeletionController::class, 'publicRequest']);
        Route::get('/status', [\App\Http\Controllers\AccountDeletionController::class, 'status']);
        Route::post('/confirm', [\App\Http\Controllers\AccountDeletionController::class, 'confirm']);
    });

    /* EXTERNAL API FOR THIRD-PARTY WEBSITES / E-COMMERCE */
    Route::middleware([VerifyStoreApiKey::class])->prefix('external')->group(function () {
        Route::get('/store-products', [ExternalStoreProductController::class, 'index']);
        Route::get('/products', [ExternalStoreProductController::class, 'index']);
    });

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/auth/checkToken', [AuthController::class, 'checkAuthToken']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);

        /* ACCOUNT DELETION (Authenticated Tenant Profile) */
        Route::prefix('account-deletion')->group(function () {
            Route::post('/request', [\App\Http\Controllers\AccountDeletionController::class, 'tenantRequest']);
            Route::get('/my-status', [\App\Http\Controllers\AccountDeletionController::class, 'tenantStatus']);
        });

        /* TENANT PLAN & USAGE */
        Route::get('/my-plan', [TenantPlanController::class, 'myPlan']);
        Route::get('/available-plans', [TenantPlanController::class, 'availablePlans']);

        // Rutas de notificaciones (requieren autenticación)
        Route::prefix('notifications')->group(function () {
            Route::get('/', [NotificationController::class, 'index']);
            Route::get('/unread', [NotificationController::class, 'unread']);
            Route::get('/unread-count', [NotificationController::class, 'unreadCount']);
            Route::match(['post', 'patch'], '/{id}/read', [NotificationController::class, 'markAsRead']);
            Route::match(['post', 'patch'], '/mark-all-read', [NotificationController::class, 'markAllAsRead']);
            Route::match(['post', 'patch'], '/read-all', [NotificationController::class, 'markAllAsRead']);
            Route::post('/send-to-user', [NotificationController::class, 'sendToUser'])->name('notifications.send-to-user');
            Route::post('/send-to-users', [NotificationController::class, 'sendToUsers'])->name('notifications.send-to-users');
            Route::post('/send-to-admins', [NotificationController::class, 'sendToAdmins']);
            Route::post('/send-to-all', [NotificationController::class, 'sendToAll']);
            Route::delete('/{id}', [NotificationController::class, 'destroy']);
        });

        Route::middleware([CheckRole::class.':notifications:manage'])
            ->prefix('notification-management')
            ->group(function () {
                Route::get('/stats', [NotificationManagementController::class, 'stats']);
                Route::get('/recipients', [NotificationManagementController::class, 'recipients']);
                Route::get('/', [NotificationManagementController::class, 'index']);
                Route::post('/', [NotificationManagementController::class, 'store']);
                Route::get('/{notification}', [NotificationManagementController::class, 'show']);
                Route::put('/{notification}', [NotificationManagementController::class, 'update']);
                Route::patch('/{notification}', [NotificationManagementController::class, 'update']);
                Route::delete('/{notification}', [NotificationManagementController::class, 'destroy']);
            });

        // Registro de dispositivos móviles para Push Notifications (FCM)
        Route::post('/device-tokens', [DeviceTokenController::class, 'store']);
        Route::delete('/device-tokens', [DeviceTokenController::class, 'destroy']);
        Route::post('/test/push', [NotificationController::class, 'testPush']);

        /* TENANT ROUTES - OWNER, ADMIN & STAFF */
        Route::middleware([CheckRole::class.':owner-admin-staff-worker'])->group(function () {
            /* DASHBOARD SUMMARY */
            Route::get('/dashboard/summary', [TenantDashboardController::class, 'summary']);

            /* SETTINGS (Read access) */
            Route::get('/settings', [SettingController::class, 'index']);
            Route::get('/settings/system-data', [SettingController::class, 'getSystemData']);
            Route::get('/settings/{id}', [SettingController::class, 'show']);

            /* STORE */
            Route::apiResource('/stores', StoreController::class);
            Route::get('/store-get-by-slug/{slug}', [StoreController::class, 'getStoreBySlug']);

            /* USER - OWNER & ADMIN (Fine-grained store/destroy handled by can()) */
            Route::middleware([CheckRole::class.':owner-admin'])->group(function () {
                Route::apiResource('/users', UserController::class);
                Route::post('/users/{user}/resend-invitation', [UserController::class, 'resendInvitation'])
                    ->middleware('throttle:5,1');
                Route::put('/user-update-role/{id}', [UserController::class, 'updateRole']);

                /* SETTINGS (Write access) */
                Route::match(['put', 'patch', 'post'], '/settings/{id}', [SettingController::class, 'update']);
                Route::match(['put', 'patch', 'post'], '/settings', [SettingController::class, 'update']);

                /* STORE API CONFIGURATION (Exclusivo Solo Dueño / Owner) */
                Route::middleware([CheckRole::class.':owner'])->group(function () {
                    Route::get('/stores/{id}/api-credentials', [StoreController::class, 'getApiCredentials']);
                    Route::post('/stores/{id}/generate-api-credentials', [StoreController::class, 'generateApiCredentials']);
                    Route::put('/stores/{id}/toggle-api-status', [StoreController::class, 'toggleApiStatus']);

                    /* SIAT — Integración Facturación Electrónica (Fase 3B & 6A) */
                    Route::prefix('siat')->group(function () {
                        Route::get('/status',                              [SiatController::class, 'status']);
                        Route::get('/readiness',                           [SiatController::class, 'tenantReadiness']);
                        Route::get('/products/readiness',                  [SiatController::class, 'productReadiness']);
                        Route::get('/sales/{sale}/fiscal-status',          [SiatController::class, 'saleFiscalStatus'])->whereUuid('sale');
                        Route::post('/verify-communication',              [SiatController::class, 'verifyCommunication']);
                        Route::get('/datetime',                           [SiatController::class, 'getDatetime']);
                        Route::post('/stores/{store}/refresh-cuis',       [SiatController::class, 'refreshCuis'])->whereUuid('store');
                        Route::post('/stores/{store}/refresh-cufd',       [SiatController::class, 'refreshCufd'])->whereUuid('store');
                        Route::post('/stores/{store}/sync-catalog/{catalog}', [SiatController::class, 'syncCatalog'])->whereUuid('store');
                        Route::get('/stores/{store}/readiness',           [SiatController::class, 'storeReadiness'])->whereUuid('store');
                        Route::post('/invoices/prepare/{sale}',           [SiatController::class, 'prepareInvoice'])->whereUuid('sale');
                        Route::post('/invoices/{invoice}/cuf',            [SiatController::class, 'generateCuf'])->whereUuid('invoice');
                        Route::post('/invoices/{invoice}/xml',            [SiatController::class, 'generateXml'])->whereUuid('invoice');
                        Route::post('/invoices/{invoice}/sign',           [SiatController::class, 'signInvoice'])->whereUuid('invoice');
                        Route::post('/invoices/{invoice}/submit',         [SiatController::class, 'submitInvoice'])->whereUuid('invoice');
                        Route::post('/invoices/{invoice}/verify',         [SiatController::class, 'verifyInvoice'])->whereUuid('invoice');
                        Route::get('/invoices/{invoice}/pdf',             [SiatController::class, 'downloadPdf'])->whereUuid('invoice');
                        Route::get('/invoices/{invoice}/representation',  [SiatController::class, 'showRepresentation'])->whereUuid('invoice');
                        Route::get('/cancellation-reasons',              [SiatController::class, 'cancellationReasons']);
                        Route::post('/invoices/{invoice}/cancel',         [SiatController::class, 'cancelInvoice'])->whereUuid('invoice');
                        Route::post('/invoices/{invoice}/reverse-cancellation', [SiatController::class, 'reverseCancellation'])->whereUuid('invoice');
                    });
                });
            });

            /* BRAND */
            Route::delete('/brands/destroy-all', [BrandController::class, 'destroyAll']);
            Route::get('/brands/export', [BrandController::class, 'export']);
            Route::get('/brands/template', [BrandController::class, 'downloadTemplate']);
            Route::post('/brands/import', [BrandController::class, 'import']);
            Route::apiResource('/brands', BrandController::class);
            /* CATEGORY */
            Route::delete('/categories/destroy-all', [CategoryController::class, 'destroyAll']);
            Route::apiResource('/categories', CategoryController::class);
            /* LOCATION */
            Route::apiResource('/locations', LocationController::class);
            /* PRODUCT */
            Route::delete('/products/destroy-all', [ProductController::class, 'destroyAll']);
            Route::get('/products/export', [ProductController::class, 'export']);
            Route::get('/products/template', [ProductController::class, 'downloadTemplate']);
            Route::post('/products/import', [ProductController::class, 'import']);
            Route::apiResource('/products', ProductController::class)->whereUuid('product');
            Route::get('/products-get-by-slug/{slug}', [ProductController::class, 'getProductBySlug']);
            Route::get('/product/{sku}', [ProductController::class, 'getProductBySku']);
            Route::get('/products-get-by-sku/{sku}', [ProductController::class, 'getProductBySku']);
            Route::get('/products/barcode/{code}', [ProductController::class, 'getProductBySku']);
            /* PRODUCT IMAGE */
            Route::get('/product-images/{product_id}', [ProductImageController::class, 'index'])->whereUuid('product_id');
            Route::post('/product-images', [ProductImageController::class, 'store']);
            Route::delete('/product-images/{id}', [ProductImageController::class, 'destroy']);
            /* SUPPLIERS */
            Route::apiResource('/suppliers', SupplierController::class);
            /* INVENTORY */
            Route::delete('/inventory-stores/destroy-all', [InventoryStoreController::class, 'destroyAll']);
            Route::delete('/inventory-stores/clear-by-store/{storeId}', [InventoryStoreController::class, 'clearByStore']);
            Route::post('/inventory-stores/{id}/return', [InventoryStoreController::class, 'returnToWarehouse']);
            Route::apiResource('/inventory-stores', InventoryStoreController::class);
            Route::get('/inventory-stores-get-by-store-slug/{slug}', [InventoryStoreController::class, 'getInventoryStoreSlug']);
            Route::get('/inventory-stores-get-by-store-slug/{slug}/barcode/{code}', [InventoryStoreController::class, 'getByBarcode']);
            Route::delete('/inventory-warehouses/destroy-out-of-stock', [InventoryWarehouseController::class, 'destroyOutOfStock']);
            Route::delete('/inventory-warehouses/destroy-all', [InventoryWarehouseController::class, 'destroyAll']);
            Route::get('/inventory-warehouses/summary', [InventoryWarehouseController::class, 'summary']);
            Route::get('/inventory-warehouses/purchase-products', [InventoryWarehouseController::class, 'purchaseProducts']);
            Route::get('/inventory-warehouses-product-ids', [InventoryWarehouseController::class, 'getRegisteredProductIds']);
            Route::post('/inventory-warehouses/bulk-purchase', [InventoryWarehouseController::class, 'bulkPurchase']);
            Route::apiResource('/inventory-warehouses', InventoryWarehouseController::class);
            /* STOCK MOVEMENTS / TRASLADOS Y GUÍAS */
            Route::get('/stock-movements', [StockMovementController::class, 'index']);
            Route::post('/stock-movements', [StockMovementController::class, 'store']);
            Route::get('/stock-movements/{id}', [StockMovementController::class, 'show']);
            Route::post('/stock-movements/{id}/return', [StockMovementController::class, 'returnMovement']);
            Route::post('/stock-movements/{id}/receive', [StockMovementController::class, 'receiveMovement']);
            Route::prefix('cash-register')->controller(\App\Http\Controllers\CashRegisterController::class)->group(function () {
                Route::post('/open', 'open');
                Route::get('/active/{store}', 'active')->whereUuid('store');
                Route::get('/history', 'history');
                Route::get('/{session}/summary', 'summary')->whereUuid('session');
                Route::post('/{session}/movements', 'movement')->whereUuid('session');
                Route::post('/{session}/close', 'close')->whereUuid('session');
            });
            /* SALES */
            Route::apiResource('/sales', SaleController::class);
            Route::get('/sales/{sale}/receipt', [SaleController::class, 'receipt'])->whereUuid('sale');
            Route::post('/sales/{sale}/cancel', [SaleController::class, 'cancel'])->whereUuid('sale');
            Route::get('/sales-get-by-store-id/{storeId}', [SaleController::class, 'getSalesByStoreId']);

            /* COMMERCIAL REFUNDS (FASE 6B.3B) */
            Route::get('/sales/{sale}/refundable', [SaleRefundController::class, 'refundable'])->whereUuid('sale');
            Route::get('/sales/{sale}/refunds', [SaleRefundController::class, 'indexBySale'])->whereUuid('sale');
            Route::post('/sales/{sale}/refunds', [SaleRefundController::class, 'store'])->whereUuid('sale');
            Route::get('/sale-refunds/{refund}', [SaleRefundController::class, 'show'])->whereUuid('refund');
            /* DETAIL SALES */
            Route::apiResource('/sale-details', SaleDetailController::class);
            Route::get('/sale-details-get-by-sale-id/{saleId}', [SaleDetailController::class, 'getSaleDetailsBySaleId']);
            Route::get('/detail-sales-get-by-sale-id/{saleId}', [SaleDetailController::class, 'getSaleDetailsBySaleId']);
            /* CUSTOMERS */
            Route::apiResource('/customers', CustomerController::class);
            /* Download backup */
            Route::get('/download-backup', [BackupController::class, 'download']);
            /* Assignments */
            Route::get('/assignments-get-by-store-id/{store_id}', [AssignmentController::class, 'getAssignmentsByStoreId']);
            Route::post('/assignments', [AssignmentController::class, 'store']);
            Route::put('/assignments/{id}', [AssignmentController::class, 'update']);
            Route::delete('/assignments/{id}', [AssignmentController::class, 'destroy']);
        });
    });
});

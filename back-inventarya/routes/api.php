<?php

use App\Http\Controllers\AssignmentController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\BackupController;
use App\Http\Controllers\BrandController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\TenantController;
use App\Http\Controllers\PlanController;
use App\Http\Controllers\SubscriptionController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\CentralUserController;
use App\Http\Controllers\CentralProfileController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\SaleDetailController;
use App\Http\Controllers\InventoryStoreController;
use App\Http\Controllers\InventoryWarehouseController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ProductImageController;
use App\Http\Controllers\SaleController;
use App\Http\Controllers\Setting\SettingController;
use App\Http\Controllers\LandingController;
use App\Http\Controllers\FaqController;
use App\Http\Controllers\CarouselController;
use App\Http\Controllers\ConfigurationController;
use App\Http\Controllers\StoreController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\AnalyticsController;
use App\Http\Middleware\CheckRole;
use Illuminate\Support\Facades\Broadcast;

foreach (config('tenancy.central_domains') as $domain) {
    Route::domain($domain)->group(function () {

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

// Landing page public data
Route::get('/landing/data', [LandingController::class, 'data']);
Route::get('/public/plans', [LandingController::class, 'plans']);
Route::get('/public/faqs', [LandingController::class, 'faqs']);
Route::get('/public/carousels', [CarouselController::class, 'index']);
Route::get('/public/configurations', [LandingController::class, 'configuration']);
Route::get('/public/tenants/search', [LandingController::class, 'searchTenants']);
Route::get('/public/tenants/resolve', [LandingController::class, 'resolveTenant']);

// Google Play Account Deletion compliance
Route::middleware('throttle:10,1')->prefix('public/account-deletion')->group(function () {
    Route::post('/request', [\App\Http\Controllers\AccountDeletionController::class, 'publicRequest']);
    Route::get('/status', [\App\Http\Controllers\AccountDeletionController::class, 'status']);
    Route::post('/confirm', [\App\Http\Controllers\AccountDeletionController::class, 'confirm']);
});

// auth
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);
//ruta /api-carousel

//ruta para obtener los datos del sistemas como logo, nombre, etc
//Route::get('/system-data', [SettingController::class, 'getSystemData']);

Broadcast::routes(['middleware' => ['auth:sanctum']]);

Route::middleware('auth:sanctum')->group(function () {
    // Rutas de notificaciones (requieren autenticación)
    Route::prefix('notifications')->group(function () {
        Route::get('/', [NotificationController::class, 'index']);
        Route::get('/unread', [NotificationController::class, 'unread']);
        Route::get('/unread-count', [NotificationController::class, 'unreadCount']);
        Route::match(['post', 'patch'], '/{id}/read', [NotificationController::class, 'markAsRead']);
        Route::match(['post', 'patch'], '/mark-all-read', [NotificationController::class, 'markAllAsRead']);
        Route::match(['post', 'patch'], '/read-all', [NotificationController::class, 'markAllAsRead']);
        Route::post('/send-to-user', [NotificationController::class, 'sendToUser']);
        Route::post('/send-to-users', [NotificationController::class, 'sendToUsers']);
        Route::post('/send-to-admins', [NotificationController::class, 'sendToAdmins']);
        Route::post('/send-to-all', [NotificationController::class, 'sendToAll']);
        Route::delete('/{id}', [NotificationController::class, 'destroy']);
    });

    Route::post('/device-tokens', [\App\Http\Controllers\Api\DeviceTokenController::class, 'store']);
    Route::delete('/device-tokens', [\App\Http\Controllers\Api\DeviceTokenController::class, 'destroy']);
    Route::post('/test/push', [NotificationController::class, 'testPush']);

    Route::get('/auth/checkToken', [AuthController::class, 'checkAuthToken']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/profile', [CentralProfileController::class, 'show']);
    Route::match(['put', 'patch'], '/auth/profile', [CentralProfileController::class, 'update']);
    Route::put('/auth/profile/password', [CentralProfileController::class, 'updatePassword']);
    //Route::apiResource('/settings', SettingController::class)->only(['show', 'update']);

    // Central Analytics Dashboard Stats
    Route::get('/analytics/business-stats', [AnalyticsController::class, 'businessStats']);

    /* CENTRAL DB - SUPERADMIN & SUPPORT */
    Route::middleware([CheckRole::class . ':superadmin-support'])->group(function () {
        Route::post('/tenants/check-unique', [TenantController::class, 'checkUnique']);
        Route::apiResource('/tenants', TenantController::class);
        Route::get('/tenants/{id}/database', [TenantController::class, 'getDatabaseTables']);
        Route::get('/tenants/{id}/database/tables/{table}', [TenantController::class, 'getTableData']);
        Route::delete('/tenants/{id}/database/tables/{table}/clear', [TenantController::class, 'clearTableData']);
        Route::get('/tenants/{id}/plan-usage', [TenantController::class, 'planUsage']);
        Route::apiResource('/plans', PlanController::class);
        Route::patch('/plans/{id}/toggle-status', [PlanController::class, 'toggleStatus']);
        Route::get('/subscriptions/stats', [SubscriptionController::class, 'stats']);
        Route::post('/subscriptions/assign', [SubscriptionController::class, 'assignPlan']);
        Route::post('/subscriptions/activate-trial', [SubscriptionController::class, 'activateTrial']);
        Route::post('/subscriptions/{id}/change-plan', [SubscriptionController::class, 'changePlan']);
        Route::post('/subscriptions/{id}/cancel', [SubscriptionController::class, 'cancelSubscription']);
        Route::apiResource('/subscriptions', SubscriptionController::class);
        Route::apiResource('/payments', PaymentController::class);
        Route::post('/payments/{id}/confirm', [PaymentController::class, 'confirm']);
        Route::post('/payments/{id}/refund', [PaymentController::class, 'refund']);
        Route::apiResource('/central-users', CentralUserController::class);
        Route::apiResource('/faqs', FaqController::class);
        Route::get('/configurations', [ConfigurationController::class, 'show']);
        Route::match(['post', 'put'], '/configurations', [ConfigurationController::class, 'update']);
        Route::apiResource('/carousels', CarouselController::class)->except(['show']);
        Route::post('/carousels/reorder', [CarouselController::class, 'reorder']);
    });
    /* END CENTRAL DB */



});


// personal access token PARA PROYECTO ACCOUNTS
Route::post('/create-token', [AuthController::class, 'createToken']);
Route::post('/delete-token/{id}', [AuthController::class, 'deleteToken']);




// Route::middleware([ValidateExternalToken::class])->group(function () {

// });

    });
}

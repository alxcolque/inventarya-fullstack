<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('cash_register_sessions', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('store_id')->constrained('stores')->restrictOnDelete();
            $t->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $t->foreignId('closed_by')->nullable()->constrained('users')->restrictOnDelete();
            $t->decimal('opening_amount', 15, 2)->default(0);
            foreach (['expected_amount', 'closing_amount', 'difference'] as $field) $t->decimal($field, 15, 2)->nullable();
            $t->string('status', 10)->default('open');
            $t->timestampTz('opened_at')->index();
            $t->timestampTz('closed_at')->nullable();
            $t->text('opening_note')->nullable();
            $t->text('closing_note')->nullable();
            $t->timestampsTz();
            $t->index(['store_id', 'opened_at']);
            $t->index('user_id');
            $t->index('status');
        });
        DB::statement("CREATE UNIQUE INDEX cash_register_one_open_per_store ON cash_register_sessions (store_id) WHERE status = 'open'");
        Schema::create('cash_register_movements', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('cash_register_session_id')->constrained('cash_register_sessions')->restrictOnDelete();
            $t->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $t->string('type', 10);
            $t->decimal('amount', 15, 2);
            $t->string('reason');
            $t->text('description')->nullable();
            $t->timestampsTz();
            $t->index(['cash_register_session_id', 'type']);
            $t->index('user_id');
        });
        Schema::table('sales', function (Blueprint $t) {
            $t->foreignUuid('cash_register_session_id')->nullable()->constrained('cash_register_sessions')->restrictOnDelete();
            $t->index('cash_register_session_id');
        });
        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE cash_register_sessions ADD CONSTRAINT cash_opening_positive CHECK (opening_amount >= 0), ADD CONSTRAINT cash_closing_positive CHECK (closing_amount IS NULL OR closing_amount >= 0), ADD CONSTRAINT cash_status_valid CHECK (status IN ('open', 'closed'))");
            DB::statement("ALTER TABLE cash_register_movements ADD CONSTRAINT cash_movement_positive CHECK (amount > 0), ADD CONSTRAINT cash_movement_type CHECK (type IN ('income', 'expense'))");
        }
    }
    public function down(): void
    {
        Schema::table('sales', fn (Blueprint $t) => $t->dropConstrainedForeignId('cash_register_session_id'));
        Schema::dropIfExists('cash_register_movements');
        Schema::dropIfExists('cash_register_sessions');
    }
};

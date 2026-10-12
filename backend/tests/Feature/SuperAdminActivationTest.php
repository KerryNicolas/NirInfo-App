<?php

namespace Tests\Feature;

use App\Console\Commands\PromouvoirSuperAdmin;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

// Mise en service du rôle super-admin : la migration (aller et retour) et la
// commande de promotion. Tout tourne dans la transaction du test, annulée à
// la fin : ni la migration ni la commande ne sont lancées « pour de vrai ».
class SuperAdminActivationTest extends TestCase
{
    private const MIGRATION = 'migrations/2026_10_13_000001_add_super_admin_and_modules_permission.php';

    protected function setUp(): void
    {
        parent::setUp();

        // Rôle super-admin et permission modules.manage, NON marqués (créés
        // par le seeder, comme sur une installation neuve).
        $this->seed(RolePermissionSeeder::class);
    }

    /** Compte de test du rôle voulu, copié sur l'admin existant. */
    private function compte(string $slug, bool $active = true): User
    {
        $modele = User::whereHas('roleRelation', fn ($q) => $q->where('slug', 'admin'))->firstOrFail();

        $compte = $modele->replicate();
        $compte->email        = "phpunit-{$slug}@test.local";
        $compte->matricule    = "TEST-PHPUNIT-{$slug}";
        $compte->role_id      = Role::where('slug', $slug)->firstOrFail()->id;
        $compte->activated_at = $active ? now() : null;
        $compte->save();

        return $compte;
    }

    /** Photographie de tout ce que la migration et la commande peuvent toucher. */
    private function etat(): array
    {
        return [
            'comptes'     => DB::table('users')->orderBy('id')->pluck('role_id', 'id')->all(),
            'roles'       => DB::table('roles')->orderBy('id')->get(['id', 'slug', 'description'])->map(fn ($r) => (array) $r)->all(),
            'permissions' => DB::table('permissions')->orderBy('id')->get(['id', 'slug', 'description'])->map(fn ($p) => (array) $p)->all(),
            'liens'       => DB::table('role_permissions')->orderBy('id')->get(['role_id', 'permission_id'])->map(fn ($l) => (array) $l)->all(),
        ];
    }

    /** Remet la base dans l'état d'avant la migration, puis l'applique : lignes marquées. */
    private function migrationAppliquee(): object
    {
        $roleId = DB::table('roles')->where('slug', 'super-admin')->value('id');
        DB::table('role_permissions')->where('role_id', $roleId)->delete();
        DB::table('roles')->where('id', $roleId)->delete();
        $permissionId = DB::table('permissions')->where('slug', 'modules.manage')->value('id');
        DB::table('role_permissions')->where('permission_id', $permissionId)->delete();
        DB::table('permissions')->where('id', $permissionId)->delete();

        $migration = require database_path(self::MIGRATION);
        $migration->up();

        return $migration;
    }

    // ── Migration ──────────────────────────────────────────────────────────

    public function test_up_ne_modifie_aucun_compte_et_se_rejoue_sans_doublon(): void
    {
        $comptesAvant = $this->etat()['comptes'];

        $migration = $this->migrationAppliquee();
        $migration->up();

        $this->assertSame($comptesAvant, $this->etat()['comptes']);
        $this->assertSame(1, DB::table('roles')->where('slug', 'super-admin')->count());
        $this->assertSame(1, DB::table('permissions')->where('slug', 'modules.manage')->count());
        $this->assertSame(['super-admin'], DB::table('role_permissions as rp')
            ->join('roles as r', 'r.id', '=', 'rp.role_id')
            ->join('permissions as p', 'p.id', '=', 'rp.permission_id')
            ->where('p.slug', 'modules.manage')->pluck('r.slug')->all());
    }

    public function test_down_rend_le_role_admin_aux_comptes_puis_retire_ses_lignes(): void
    {
        $migration = $this->migrationAppliquee();
        $principal = $this->compte('super-admin');
        $autres    = collect($this->etat()['comptes'])->except($principal->id)->all();

        $migration->down();

        $this->assertFalse(DB::table('roles')->where('slug', 'super-admin')->exists());
        $this->assertFalse(DB::table('permissions')->where('slug', 'modules.manage')->exists());
        $this->assertSame('admin', $principal->fresh()->roleRelation?->slug);
        $this->assertSame($autres, collect($this->etat()['comptes'])->except($principal->id)->all(), 'Les autres comptes ne changent pas.');
        // Aucune attribution ne pointe vers un rôle ou une permission disparus.
        $this->assertSame(0, DB::table('role_permissions as rp')
            ->leftJoin('roles as r', 'r.id', '=', 'rp.role_id')
            ->leftJoin('permissions as p', 'p.id', '=', 'rp.permission_id')
            ->where(fn ($q) => $q->whereNull('r.id')->orWhereNull('p.id'))->count());
    }

    public function test_down_est_refuse_sans_role_admin_et_ne_modifie_rien(): void
    {
        $migration = $this->migrationAppliquee();
        $principal = $this->compte('super-admin');
        // Le rôle admin « disparaît » : plus personne pour reprendre le compte.
        DB::table('roles')->where('slug', 'admin')->update(['slug' => 'admin-absent']);
        $avant = $this->etat();

        try {
            $migration->down();
            $this->fail('Le retour arrière aurait dû être interrompu.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString("rien n'a été modifié", $e->getMessage());
            $this->assertStringContainsString('1 compte(s)', $e->getMessage());
        }

        $this->assertSame($avant, $this->etat(), 'Aucune modification partielle.');
        $this->assertTrue($principal->fresh()->isSuperAdmin());
    }

    public function test_down_sans_compte_super_admin_n_exige_pas_le_role_admin(): void
    {
        $migration = $this->migrationAppliquee();
        DB::table('roles')->where('slug', 'admin')->update(['slug' => 'admin-absent']);
        $comptesAvant = $this->etat()['comptes'];

        $migration->down();

        $this->assertFalse(DB::table('roles')->where('slug', 'super-admin')->exists());
        $this->assertSame($comptesAvant, $this->etat()['comptes']);
    }

    public function test_down_conserve_un_role_et_une_permission_homonymes_non_marques(): void
    {
        // État du setUp : rôle et permission créés par le seeder, sans marque.
        $principal = $this->compte('super-admin');
        $migration = require database_path(self::MIGRATION);
        $migration->up(); // ne touche pas aux lignes existantes
        $avant = $this->etat();

        $this->assertNull(DB::table('roles')->where('slug', 'super-admin')->value('description'));

        $migration->down();

        $this->assertSame($avant, $this->etat(), 'Rien de ce qui a été créé ailleurs n\'est retiré.');
        $this->assertTrue($principal->fresh()->isSuperAdmin());
    }

    // ── Commande de promotion ──────────────────────────────────────────────

    public function test_la_commande_affiche_le_recapitulatif_puis_promeut_apres_confirmation(): void
    {
        $compte = $this->compte('admin');

        $this->artisan('app:promouvoir-super-admin', ['email' => $compte->email])
            ->expectsOutputToContain("Compte        : {$compte->name} <{$compte->email}>")
            ->expectsOutputToContain('Rôle actuel   : admin')
            ->expectsOutputToContain('Activation    : compte activé')
            ->expectsOutputToContain('Base          : ' . DB::connection()->getDatabaseName())
            ->expectsOutputToContain('Serveur       : ' . config('database.connections.mysql.host') . ':' . config('database.connections.mysql.port'))
            ->expectsOutputToContain('Environnement : testing')
            ->expectsConfirmation(PromouvoirSuperAdmin::QUESTION, 'yes')
            ->assertExitCode(0);

        $this->assertTrue($compte->fresh()->isSuperAdmin());
    }

    public function test_la_commande_annulee_ne_modifie_aucun_compte(): void
    {
        $compte = $this->compte('admin');
        $avant  = $this->etat();

        $this->artisan('app:promouvoir-super-admin', ['email' => $compte->email])
            ->expectsOutputToContain('Récapitulatif avant écriture')
            ->expectsConfirmation(PromouvoirSuperAdmin::QUESTION, 'no')
            ->expectsOutputToContain('Annulé : aucun compte modifié.')
            ->assertExitCode(1);

        $this->assertSame($avant, $this->etat());
    }

    public function test_force_garde_le_recapitulatif(): void
    {
        $compte = $this->compte('admin');

        $this->artisan('app:promouvoir-super-admin', ['email' => $compte->email, '--force' => true])
            ->expectsOutputToContain('Récapitulatif avant écriture')
            ->expectsOutputToContain("Compte        : {$compte->name} <{$compte->email}>")
            ->expectsOutputToContain('Base          : ' . DB::connection()->getDatabaseName())
            ->expectsOutputToContain('Environnement : testing')
            ->assertExitCode(0);

        $this->assertTrue($compte->fresh()->isSuperAdmin());
    }

    public function test_sans_terminal_ni_force_la_commande_refuse(): void
    {
        $compte = $this->compte('admin');
        $avant  = $this->etat();

        $this->artisan('app:promouvoir-super-admin', ['email' => $compte->email, '--no-interaction' => true])
            ->expectsOutputToContain('Récapitulatif avant écriture')
            ->expectsOutputToContain('Confirmation impossible sans terminal interactif')
            ->assertExitCode(1);

        $this->assertSame($avant, $this->etat());
    }

    public static function avecEtSansForce(): array
    {
        return ['avec confirmation' => [false], 'avec --force' => [true]];
    }

    /** @dataProvider avecEtSansForce */
    public function test_une_adresse_inconnue_est_refusee(bool $force): void
    {
        $this->compte('admin');
        $avant = $this->etat();

        $this->artisan('app:promouvoir-super-admin', ['email' => 'inconnu@test.local', '--force' => $force])
            ->expectsOutputToContain('Aucun compte ne porte cette adresse email.')
            ->assertExitCode(1);

        $this->assertSame($avant, $this->etat());
    }

    /** @dataProvider avecEtSansForce */
    public function test_un_compte_non_active_est_refuse(bool $force): void
    {
        $compte = $this->compte('admin', false);
        $avant  = $this->etat();

        // Le récapitulatif s'affiche quand même, AVANT le refus.
        $this->artisan('app:promouvoir-super-admin', ['email' => $compte->email, '--force' => $force])
            ->expectsOutputToContain('Activation    : compte NON activé')
            ->expectsOutputToContain("Ce compte n'est pas activé")
            ->assertExitCode(1);

        $this->assertSame($avant, $this->etat());
        $this->assertFalse($compte->fresh()->isSuperAdmin());
    }

    public function test_sans_role_super_admin_la_commande_refuse(): void
    {
        $compte = $this->compte('admin');
        $roleId = DB::table('roles')->where('slug', 'super-admin')->value('id');
        DB::table('role_permissions')->where('role_id', $roleId)->delete();
        DB::table('roles')->where('id', $roleId)->delete();
        $avant = $this->etat();

        $this->artisan('app:promouvoir-super-admin', ['email' => $compte->email, '--force' => true])
            ->expectsOutputToContain("Le rôle super-admin n'existe pas sur cette base")
            ->assertExitCode(1);

        $this->assertSame($avant, $this->etat());
    }

    public function test_un_compte_deja_super_admin_n_est_pas_modifie(): void
    {
        $compte = $this->compte('super-admin');
        $avant  = $this->etat();

        $this->artisan('app:promouvoir-super-admin', ['email' => $compte->email, '--force' => true])
            ->expectsOutputToContain('est déjà administrateur principal')
            ->assertExitCode(0);

        $this->assertSame($avant, $this->etat());
    }
}

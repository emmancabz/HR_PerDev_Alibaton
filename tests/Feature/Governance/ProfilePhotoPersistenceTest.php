<?php

namespace Tests\Feature\Governance;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProfilePhotoPersistenceTest extends TestCase
{
    use RefreshDatabase;

    public function test_profile_photo_is_persisted_in_database_and_served_without_public_storage_symlink(): void
    {
        Storage::fake('public');
        $user = User::factory()->create(['role' => UserRole::Admin->value]);

        $response = $this->actingAs($user)->post(route('governance.api.settings.profile-photo'), [
            'photo' => UploadedFile::fake()->image('avatar.jpg', 160, 160),
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('user_profile_photos', ['user_id' => $user->id]);
        $this->assertNotNull(DB::table('user_profile_photos')->where('user_id', $user->id)->value('photo_data'));

        $user->refresh();
        $this->assertNotNull($user->profile_photo_path);

        $this->actingAs($user)
            ->get(route('account.profile-photo', ['v' => $user->profile_photo_updated_at?->timestamp ?? 0]))
            ->assertOk()
            ->assertHeader('content-type', 'image/jpeg');
    }
}

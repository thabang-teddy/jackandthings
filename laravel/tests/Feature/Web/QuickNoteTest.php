<?php

declare(strict_types=1);

namespace Tests\Feature\Web;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The home page's note popup posts and edits through the ordinary notes
 * routes, but must not throw the user into the Notes module. `return_to`
 * selects the destination; anything else keeps the historical behaviour.
 */
class QuickNoteTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_quick_note_returns_to_the_home_page(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->post(route('notes.store'), [
                'title' => 'Quick note',
                'body' => 'From the popup',
                'return_to' => 'home',
            ])
            ->assertRedirect(route('home'));

        $this->assertDatabaseHas('notes', [
            'user_id' => $user->id,
            'title' => 'Quick note',
        ]);
    }

    public function test_a_note_created_elsewhere_still_lands_on_the_notes_list(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->post(route('notes.store'), ['title' => 'Normal note'])
            ->assertRedirect(route('notes.index'));
    }

    public function test_the_return_to_field_cannot_redirect_anywhere_else(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->post(route('notes.store'), [
                'title' => 'Sneaky note',
                'return_to' => 'https://example.test/elsewhere',
            ])
            ->assertRedirect(route('notes.index'));
    }

    public function test_a_quick_note_still_needs_a_title(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->post(route('notes.store'), ['title' => '', 'return_to' => 'home'])
            ->assertSessionHasErrors('title');

        $this->assertDatabaseCount('notes', 0);
    }

    public function test_a_quick_note_edit_returns_to_the_home_page(): void
    {
        $user = User::factory()->create();
        $note = $user->notes()->create([
            'title' => 'Before',
            'body' => 'Old body',
        ]);

        $this->actingAs($user)
            ->put(route('notes.update', $note), [
                'title' => 'After',
                'body' => 'New body',
                'return_to' => 'home',
            ])
            ->assertRedirect(route('home'));

        $this->assertDatabaseHas('notes', [
            'id' => $note->id,
            'title' => 'After',
            'body' => 'New body',
        ]);
    }

    public function test_a_note_edited_elsewhere_still_lands_on_the_notes_list(): void
    {
        $user = User::factory()->create();
        $note = $user->notes()->create(['title' => 'Before']);

        $this->actingAs($user)
            ->put(route('notes.update', $note), ['title' => 'Normal edit'])
            ->assertRedirect(route('notes.index'));
    }

    public function test_a_quick_note_edit_cannot_redirect_anywhere_else(): void
    {
        $user = User::factory()->create();
        $note = $user->notes()->create(['title' => 'Before']);

        $this->actingAs($user)
            ->put(route('notes.update', $note), [
                'title' => 'Sneaky edit',
                'return_to' => 'https://example.test/elsewhere',
            ])
            ->assertRedirect(route('notes.index'));
    }
}

<?php

declare(strict_types=1);

namespace Tests\Feature\Web;

use App\Models\Note;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Starring a note pins it to the home page, and only starred notes appear
 * there.
 *
 * The update path is where the care is needed: NoteRequest validates only
 * the fields present so a list row can send `is_starred` on its own, which
 * means the rules that normally guard a note have to still hold when most
 * of it is absent.
 */
class StarredNoteTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_note_starts_unstarred(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->post(route('notes.store'), ['title' => 'Draft']);

        $this->assertFalse($user->notes()->sole()->is_starred);
    }

    public function test_a_note_can_be_created_starred(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->post(route('notes.store'), [
            'title' => 'Shopping list',
            'is_starred' => true,
        ]);

        $this->assertTrue($user->notes()->sole()->is_starred);
    }

    public function test_the_star_can_be_toggled_without_resending_the_note(): void
    {
        $user = User::factory()->create();
        $note = $user->notes()->create(['title' => 'Project idea', 'body' => 'Merge the apps']);

        $this->actingAs($user)
            ->put(route('notes.update', $note), ['is_starred' => true])
            ->assertRedirect(route('notes.index'));

        $note->refresh();
        $this->assertTrue($note->is_starred);
        // The fields the row did not send must survive untouched.
        $this->assertSame('Project idea', $note->title);
        $this->assertSame('Merge the apps', $note->body);
    }

    public function test_the_star_can_be_taken_off_again(): void
    {
        $user = User::factory()->create();
        $note = $user->notes()->create(['title' => 'Project idea', 'is_starred' => true]);

        $this->actingAs($user)->put(route('notes.update', $note), ['is_starred' => false]);

        $this->assertFalse($note->refresh()->is_starred);
    }

    public function test_editing_a_note_leaves_its_star_alone(): void
    {
        $user = User::factory()->create();
        $note = $user->notes()->create(['title' => 'Draft', 'is_starred' => true]);

        $this->actingAs($user)->put(route('notes.update', $note), [
            'title' => 'Final',
            'body' => 'Body',
        ]);

        $note->refresh();
        $this->assertSame('Final', $note->title);
        $this->assertTrue($note->is_starred);
    }

    public function test_a_partial_update_cannot_reassign_the_note_to_somebody_else(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $note = $user->notes()->create(['title' => 'Project idea']);

        $this->actingAs($user)->put(route('notes.update', $note), [
            'is_starred' => true,
            'user_id' => $other->id,
        ]);

        $this->assertSame($user->id, $note->refresh()->user_id);
    }

    public function test_a_create_still_needs_a_title(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->post(route('notes.store'), ['is_starred' => true])
            ->assertSessionHasErrors('title');

        $this->assertSame(0, $user->notes()->count());
    }

    public function test_the_star_must_be_a_boolean(): void
    {
        $user = User::factory()->create();
        $note = $user->notes()->create(['title' => 'Draft']);

        $this->actingAs($user)
            ->put(route('notes.update', $note), ['is_starred' => 'yes please'])
            ->assertSessionHasErrors('is_starred');
    }

    public function test_the_notes_list_says_which_are_starred(): void
    {
        $user = User::factory()->create();
        $user->notes()->create(['title' => 'Pinned', 'is_starred' => true]);
        $user->notes()->create(['title' => 'Ordinary']);

        $this->actingAs($user)
            ->get(route('notes.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Notes/Index')
                ->has('notes.data', 2)
                ->where('notes.data.0.is_starred', false)
                ->where('notes.data.1.is_starred', true)
            );
    }

    public function test_the_home_page_shows_starred_notes_only(): void
    {
        $user = User::factory()->create();
        $user->notes()->create(['title' => 'Pinned', 'is_starred' => true]);
        $user->notes()->create(['title' => 'Ordinary']);

        $this->actingAs($user)
            ->get(route('home'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Welcome')
                ->has('notes', 1)
                ->where('notes.0.title', 'Pinned')
            );
    }

    public function test_the_home_page_is_empty_when_nothing_is_starred(): void
    {
        $user = User::factory()->create();
        Note::factory()->count(3)->for($user)->create();

        $this->actingAs($user)
            ->get(route('home'))
            ->assertInertia(fn (Assert $page) => $page->has('notes', 0));
    }

    public function test_the_home_page_caps_how_many_it_pins(): void
    {
        $user = User::factory()->create();
        Note::factory()->count(6)->for($user)->create(['is_starred' => true]);

        $this->actingAs($user)
            ->get(route('home'))
            ->assertInertia(fn (Assert $page) => $page->has('notes', 4));
    }

    public function test_another_users_starred_note_never_reaches_the_home_page(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $other->notes()->create(['title' => 'Theirs', 'is_starred' => true]);

        $this->actingAs($user)
            ->get(route('home'))
            ->assertInertia(fn (Assert $page) => $page->has('notes', 0));
    }
}

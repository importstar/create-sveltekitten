<script lang="ts">
	import { page } from '$app/stores';
	import { noteClass } from '$lib/features/notes/format';
	import type { Note } from '$lib/features/notes/schema';

	const notes: Note[] = [{ id: '1', text: 'Written by the user, not by the template' }];
</script>

<h1>Notes at {$page.url.pathname}</h1>
{#each notes as note (note.id)}
	<p class={noteClass(note)}>{note.text}</p>
{/each}

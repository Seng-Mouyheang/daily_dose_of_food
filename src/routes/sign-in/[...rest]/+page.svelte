<script lang="ts">
	import { SignIn } from 'svelte-clerk';
</script>

<div class="auth-page">
	<SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
</div>

<style>
	.auth-page {
		display: flex;
		justify-content: center;
		padding: 3rem 1rem;
	}
</style>

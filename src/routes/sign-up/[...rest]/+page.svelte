<script lang="ts">
	import { SignUp } from 'svelte-clerk';
</script>

<div class="auth-page">
	<SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
</div>

<style>
	.auth-page {
		display: flex;
		justify-content: center;
		padding: 3rem 1rem;
	}
</style>

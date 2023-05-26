<script>
  import firebase from 'firebase/compat/app';
  import axios from 'axios';

  import { apiBaseUrl, otbBaseUrl } from './config';

  let enterPhone = true;
  let cleanMobile = '';
  let dirtyMobile = '';

  let enterCode = false;
  let code;

  $: len = String(dirtyMobile)?.length;
  $: officialNumber = `+1${cleanMobile}`;

  $: {
    if (len === 10) {
      cleanMobile = dirtyMobile;
    } else {
      cleanMobile = '';
    }
  }

  let user;
  firebase.auth().onAuthStateChanged((u) => {
    user = u;

    if (user) {
      enterPhone = false;
    }
  });

  async function verifyCode() {
    if (!code && String(code).length !== 6) {
      alert('Please enter the 6-digit verification code');
      return;
    }

    const response = await axios.post(apiBaseUrl + '/verify_code', { mobile: officialNumber, code });
    const { token } = response.data;

    if (token) {
      await login(token);
    } else {
      alert('Failed to authenticate');
    }
  }

  async function preAuth() {
    if (!cleanMobile) {
      alert('Please enter the 10-digit mobile number for this device');
      return;
    }

    try {
      await axios.post(otbBaseUrl + '/send_code', { mobile: officialNumber });
      enterPhone = false;
      enterCode = true;
    } catch (error) {
      console.error(error);
      if(error?.response?.data?.code === 'auth/user-not-found') {
        alert('Your phone number was not recognized. Please contact management.');

        return;
      }

      alert('whoops, try again later');
    }

  }

  function logout() {
    firebase.auth().signOut();
  }
  async function login(token) {
    await firebase.auth().signInWithCustomToken(token);
    enterPhone = false;
    enterCode = false;
  }
</script>

<div class="container">
  <nav>
    <ul>
      <li>
        <a href="/">OTB Auth</a>
      </li>
    </ul>
    <ul>
      <li style="text-align: right;">
        {#if user}
          <strong>{user?.displayName}</strong>
          <br />
          {user?.phoneNumber}
          {:else}
          <strong>Not Authenticated</strong>
          <br />
          Please login below
        {/if}
      </li>
    </ul>
  </nav>
  <div class="grid">
    {#if enterPhone}
      <hgroup>
        <h2>Mobile Pre-auth</h2>
        <h4>Please enter your phone number</h4>
      </hgroup>
      Number: {dirtyMobile} Length: {len}
      <form on:submit|preventDefault={preAuth}>
        <input
          bind:value={dirtyMobile}
          type="number"
          placeholder="5553331111"
        />
        <button type="submit">Send</button>
      </form>
    {/if}

    {#if enterCode}
      <hgroup>
        <h2>Mobile Verification</h2>
        <h4>Please enter your Verification Code</h4>
      </hgroup>
      <form on:submit|preventDefault={verifyCode}>
        <input
          bind:value={code}
          type="number"
        />
      </form>
    {/if}

    {#if user}
      <button class="outline" on:click={logout}>Logout</button>
    {/if}
  </div>
</div>

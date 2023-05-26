# @otb/auth
Outside-the-Box Auth

This is just a spike project.  Will deprecate soon.


## Start it
Use npm instead of pnpm if you want.
```
pnpm install
```

### In another terminal pane (this runs firebase env)
```
pnpm emulate
```

### (Optional) In one terminal pane (this is needed if you want to make changes)
```
pnpm dev
```

## App Running on Port 5000

1) Must add .env file with twilio creds to receive text (or just copy it from server console)
1) Create a user in the auth system with your phone number
1) Whitelist that same phone number in emulator RTDB
```
authorized_users:
  +15558881234:
    active: true
```

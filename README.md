# Address Finder

Find an address from coordinates using Nominatim, adjust the location on the map,
or edit the address manually.

## Deploy to GitHub Pages

The included GitHub Actions workflow builds and deploys the site when changes
are pushed to `main`. GitHub Pages serves it at
`https://<owner>.github.io/<repository>/` (for a repository named
`address-finder`, that is `https://<owner>.github.io/address-finder/`). In the
repository settings, set **Pages → Build and deployment → Source** to
**GitHub Actions**. If your default branch isn’t `main`, update the workflow
branch filter in `.github/workflows/deploy.yml`.

To build locally:

```sh
npm ci
npm run build
```

## Run on a local network

Install dependencies and start the Vite server so other devices on your Wi-Fi can connect:

```sh
npm install
npm run dev:network
```

Vite prints a **Network** URL. Open that address on your phone while it is connected to the same Wi-Fi network.

## Enable phone location

Mobile browsers require a secure context for location access. `localhost` is trusted automatically, but a plain `http://<computer-lan-ip>` address usually is not. Create a locally trusted certificate for the computer's LAN IP with [mkcert](https://github.com/FiloSottile/mkcert):

```sh
mkcert -install
mkdir -p .certs
mkcert -key-file .certs/local-key.pem -cert-file .certs/local.pem 192.168.1.25
```

Replace `192.168.1.25` with the computer's LAN IP. Trust mkcert's root CA on the phone using the instructions for its operating system. The CA certificate is in the directory printed by `mkcert -CAROOT`; install only `rootCA.pem`, and never copy or share `rootCA-key.pem`.

Start Vite with the certificate:

```sh
DEV_HTTPS_KEY=.certs/local-key.pem DEV_HTTPS_CERT=.certs/local.pem npm run dev:network
```

Open `https://192.168.1.25:5173` on the phone, replacing `192.168.1.25` with the certificate's LAN IP, and allow location access. Use **Use my location** to find nearby addresses. The phone and computer must be on the same network, and the computer firewall must allow port `5173` on that network.

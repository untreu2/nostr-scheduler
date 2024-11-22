const config = {
    server: {
      protocol: "http",
      ip: "0.0.0.0",
      port: 3000,
      ssl: {
        key: "./ssl/key.pem",
        cert: "./ssl/cert.pem",
      },
    },
    relays: [
      'wss://strfry.iris.to',
      'wss://relay.damus.io',
      'wss://relay.nostr.band',
      'wss://relay.snort.social',
      'wss://vitor.nostr1.com',
      'wss://nos.lol',
      'wss://untreu.me',
    ],
  };
  
  export default config;
  
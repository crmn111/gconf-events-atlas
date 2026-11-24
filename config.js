/* Site flags. Alerts stay off until a Supabase project and Resend
   sending domain exist and the edge functions are deployed.
   Flip alertsEnabled only after subscribe/confirm/unsubscribe work.

   cartoKey: optional. Request a free key (no account) at
   https://carto.com/basemaps/apikey and paste it here. Vector Voyager,
   Positron and Dark Matter currently load without one; a key future-proofs
   the map if CARTO later requires it for vector tiles, and is required
   for their raster CDN. */
window.ATLASCONFIG = {
  alertsEnabled: false,
  supabaseUrl: "",
  subscribeFn: "",
  viewsEnabled: false,
  viewsFn: "",
  claimEmail: "hello@gconf.ai",
  claimEndpoint: "",
  cartoKey: "",
  /* Public R2 origin for img/* (no trailing slash). Leave empty to keep relative /img/ paths. */
  imageBase: "https://pub-e858463479f64cd7bcc799a8cb8dd93c.r2.dev"
};

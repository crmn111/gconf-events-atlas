/* Site flags. Alerts stay off until a Supabase project and Resend
   sending domain exist and the edge functions are deployed.
   Flip alertsEnabled only after subscribe/confirm/unsubscribe work. */
window.ATLASCONFIG = {
  alertsEnabled: false,
  supabaseUrl: "",
  subscribeFn: "",
  viewsEnabled: false,
  viewsFn: "",
  claimEmail: ""
};

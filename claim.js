/* GConf Events Atlas · claim-this-listing dialog.
   Official socials are taken only from gconf.ai plus X @gconfhq.
   Dialog markup is created in JS so it is not indexed on SEO pages. */
(function (global) {
  "use strict";

  var SITE = "https://crmn111.github.io/gconf-events-atlas";
  var PRIVACY_URL = "https://gconf.ai/privacy";
  /* Public contact from gconf.ai/terms: "You can contact us at hello@gconf.ai". */
  var CONTACT_EMAIL = "hello@gconf.ai";
  /* gconf.ai footer and legal pages listed no social profile links.
     X @gconfhq is included by brief, and is the only handle used here. */
  var SOCIALS = [
    {
      id: "x",
      label: "Follow @gconfhq on X",
      handle: "@gconfhq",
      profile: "https://x.com/gconfhq",
      intent: "https://x.com/intent/follow?screen_name=gconfhq"
    }
  ];
  var THIN_CITIES = { "": 1, tba: 1, tbc: 1, unknown: 1, "n/a": 1, na: 1, tbd: 1 };
  var dlg = null;
  var listing = null;

  function cfg() {
    return global.ATLASCONFIG || {};
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function placeSlug(s) {
    return String(s || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
  function citySlug(city) {
    var c = String(city || "").trim();
    if (!c || THIN_CITIES[c.toLowerCase()]) return "tba";
    return placeSlug(c) || "tba";
  }
  function countrySlug(country) {
    return placeSlug(String(country || "").trim()) || "tba";
  }
  function hotelSlug(rec) {
    if (rec && rec.slug) return rec.slug;
    return placeSlug((rec && rec.name) || "") || "hotel";
  }
  function listingCanonical(type, rec) {
    if (!rec) return SITE + "/";
    if (rec.canonical) return rec.canonical;
    var slug = rec.slug || (type === "hotel" ? hotelSlug(rec) : "");
    if (type === "event" && slug) {
      return SITE + "/events/" + countrySlug(rec.country) + "/" + citySlug(rec.city) + "/" + slug + "/";
    }
    if (type === "venue" && slug) {
      return SITE + "/venues/" + countrySlug(rec.country) + "/" + citySlug(rec.city) + "/" + slug + "/";
    }
    if (type === "hotel" && slug) {
      return SITE + "/#/hotel/" + encodeURIComponent(slug);
    }
    return SITE + "/";
  }
  function verifiedInfo(type, rec) {
    if (!rec) return null;
    var v = rec.verified;
    if (v && (v.at || v.verified_at)) {
      return {
        at: v.at || v.verified_at,
        handle: v.by_handle || v.verified_by_handle || ""
      };
    }
    var slug = rec.slug || (type === "hotel" ? hotelSlug(rec) : "");
    var list = (global.ATLASDATA && global.ATLASDATA.verifiedClaims) || [];
    for (var i = 0; i < list.length; i++) {
      var row = list[i];
      if (row && row.slug === slug && (!type || row.type === type)) {
        return { at: row.verified_at, handle: row.verified_by_handle || "" };
      }
    }
    return null;
  }
  function isVerified(type, rec) {
    return !!verifiedInfo(type, rec);
  }
  function fmtVerifiedDate(iso) {
    if (!iso) return "";
    var raw = String(iso);
    var d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw + "T12:00:00" : raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }
  function badgeHtml(type, rec) {
    var info = verifiedInfo(type, rec);
    if (!info) return "";
    var when = fmtVerifiedDate(info.at);
    var tip = when ? "Verified by organiser on " + when : "Verified by organiser";
    return (
      '<span class="verified-badge" tabindex="0" data-tip="' +
      esc(tip) +
      '" title="' +
      esc(tip) +
      '"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4.6 8.2 7 10.5l4.5-5.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="verified-label">Verified by organiser</span></span>'
    );
  }
  function contactEmail() {
    return (cfg().claimEmail || CONTACT_EMAIL).trim() || CONTACT_EMAIL;
  }

  function ensureDialog() {
    if (dlg && dlg.isConnected) return dlg;
    dlg = document.createElement("dialog");
    dlg.className = "claim-dialog";
    dlg.setAttribute("aria-labelledby", "claim-dialog-title");
    dlg.setAttribute("data-nosnippet", "");
    dlg.innerHTML =
      '<div class="claim-dialog-inner">' +
      '<button type="button" class="claim-close" aria-label="Close">&times;</button>' +
      '<h2 id="claim-dialog-title">Claim this listing</h2>' +
      '<p class="claim-lead">GConf reviews claims by hand. Follow our official accounts and repost the listing so we can verify the claim before we update the record.</p>' +
      '<section class="claim-step" aria-labelledby="claim-step-1">' +
      '<h3 id="claim-step-1">1. Follow GConf</h3>' +
      "<p>Follow every official GConf account listed here, then tick to confirm. We use the follow to help verify your claim.</p>" +
      '<div class="claim-follows"></div>' +
      "</section>" +
      '<section class="claim-step" aria-labelledby="claim-step-2">' +
      '<h3 id="claim-step-2">2. Repost the listing</h3>' +
      "<p>Share the canonical Atlas page (this listing) and keep a link to your post. Mention @gconfhq so we can find it.</p>" +
      '<div class="claim-share-row">' +
      '<a class="btn primary" id="claim-x-post" href="#" target="_blank" rel="noopener">Repost on X</a>' +
      '<a class="btn" id="claim-li-share" href="#" target="_blank" rel="noopener">Share on LinkedIn</a>' +
      '<button type="button" class="btn" id="claim-copy-link">Copy link</button>' +
      "</div>" +
      '<p class="claim-status" id="claim-copy-status" hidden></p>' +
      "</section>" +
      '<form id="claim-form" class="claim-step" novalidate>' +
      '<h3 id="claim-step-3">3. Send your claim</h3>' +
      "<p>Tell us who you are at the organiser. We will only use these details to review this claim.</p>" +
      '<label class="flab" for="claim-name">Your name</label>' +
      '<input id="claim-name" name="name" type="text" autocomplete="name" required>' +
      '<label class="flab" for="claim-email">Work email</label>' +
      '<input id="claim-email" name="email" type="email" autocomplete="email" required placeholder="you@organiser.com">' +
      '<label class="flab" for="claim-role">Your role at the organiser</label>' +
      '<input id="claim-role" name="role" type="text" autocomplete="organization-title" required placeholder="e.g. Head of communications">' +
      '<label class="flab" for="claim-listing">Event or venue</label>' +
      '<input id="claim-listing" name="listing_name" type="text" required>' +
      '<label class="flab" for="claim-handles">Social handle(s) you used</label>' +
      '<input id="claim-handles" name="social_handles" type="text" required placeholder="@yourhandle">' +
      '<label class="flab" for="claim-repost">Link to your repost</label>' +
      '<input id="claim-repost" name="repost_url" type="url" required placeholder="https://">' +
      '<label class="claim-check" style="margin-top:14px">' +
      '<input id="claim-consent" name="consent" type="checkbox" required>' +
      "<span>I agree to be contacted about this claim.</span>" +
      "</label>" +
      '<p class="claim-privacy">Follows and the repost are used to verify that you represent the organiser. Claims are reviewed manually and are not published automatically. We will use your name, work email and the details you send only to assess this claim. See the <a href="' +
      esc(PRIVACY_URL) +
      '" target="_blank" rel="noopener">GConf privacy statement</a>.</p>' +
      '<button type="submit" class="btn primary" id="claim-submit">Submit claim</button>' +
      '<p class="claim-status" id="claim-form-status" role="status"></p>' +
      "</form>" +
      "</div>";

    var follows = dlg.querySelector(".claim-follows");
    SOCIALS.forEach(function (s) {
      var row = document.createElement("div");
      row.className = "claim-follow-row";
      row.innerHTML =
        '<a class="btn primary" href="' +
        esc(s.intent || s.profile) +
        '" target="_blank" rel="noopener">' +
        esc(s.label) +
        "</a>" +
        '<label class="claim-check"><input type="checkbox" class="claim-followed" data-social="' +
        esc(s.id) +
        '"> I followed</label>';
      follows.appendChild(row);
    });

    dlg.querySelector(".claim-close").addEventListener("click", close);
    dlg.addEventListener("click", function (ev) {
      if (ev.target === dlg) close();
    });
    dlg.addEventListener("cancel", function () {
      document.documentElement.classList.remove("claim-open");
    });
    dlg.addEventListener("close", function () {
      document.documentElement.classList.remove("claim-open");
    });
    dlg.querySelector("#claim-copy-link").addEventListener("click", copyLink);
    dlg.querySelector("#claim-form").addEventListener("submit", onSubmit);
    document.body.appendChild(dlg);
    return dlg;
  }

  function shareText(rec, url) {
    var name = (rec && rec.name) || "this listing";
    return "Claiming " + name + " on the GConf Events Atlas via @gconfhq";
  }
  function fillListing(rec) {
    listing = rec;
    var url = rec.canonical || listingCanonical(rec.type, rec);
    rec.canonical = url;
    var x = dlg.querySelector("#claim-x-post");
    var li = dlg.querySelector("#claim-li-share");
    var text = shareText(rec, url);
    x.href =
      "https://x.com/intent/post?text=" +
      encodeURIComponent(text) +
      "&url=" +
      encodeURIComponent(url);
    li.href = "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(url);
    dlg.querySelector("#claim-listing").value = rec.name || rec.slug || "";
    dlg.querySelector("#claim-form-status").textContent = "";
    dlg.querySelector("#claim-form-status").className = "claim-status";
    var cs = dlg.querySelector("#claim-copy-status");
    cs.hidden = true;
    cs.textContent = "";
    dlg.querySelectorAll(".claim-followed").forEach(function (box) {
      box.checked = false;
    });
    dlg.querySelector("#claim-form").reset();
    dlg.querySelector("#claim-listing").value = rec.name || rec.slug || "";
  }
  function copyLink() {
    var url = (listing && listing.canonical) || "";
    var status = dlg.querySelector("#claim-copy-status");
    function ok() {
      status.hidden = false;
      status.textContent = "Link copied.";
      status.className = "claim-status is-ok";
    }
    function fail() {
      status.hidden = false;
      status.textContent = "Copy failed. The listing URL is " + url;
      status.className = "claim-status is-err";
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(ok).catch(fail);
    } else {
      try {
        var t = document.createElement("textarea");
        t.value = url;
        document.body.appendChild(t);
        t.select();
        document.execCommand("copy");
        t.remove();
        ok();
      } catch (e) {
        fail();
      }
    }
  }
  function payloadFromForm(form) {
    var followed = {};
    dlg.querySelectorAll(".claim-followed").forEach(function (box) {
      followed[box.getAttribute("data-social")] = !!box.checked;
    });
    return {
      listing_type: listing.type,
      listing_slug: listing.slug || hotelSlug(listing),
      listing_name: form.listing_name.value.trim(),
      listing_url: listing.canonical,
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      role: form.role.value.trim(),
      social_handles: form.social_handles.value.trim(),
      repost_url: form.repost_url.value.trim(),
      followed: followed,
      consent: form.consent.checked === true,
      submitted_at: new Date().toISOString()
    };
  }
  function mailtoHref(data) {
    var to = contactEmail();
    var subject = "Claim listing: " + data.listing_name;
    var lines = [
      "Claim this listing — GConf Events Atlas",
      "",
      "Listing type: " + data.listing_type,
      "Listing: " + data.listing_name,
      "Slug: " + data.listing_slug,
      "Canonical URL: " + data.listing_url,
      "",
      "Name: " + data.name,
      "Work email: " + data.email,
      "Role: " + data.role,
      "Social handle(s): " + data.social_handles,
      "Repost URL: " + data.repost_url,
      "Followed official accounts: " + JSON.stringify(data.followed),
      "Consent to be contacted about this claim: yes",
      "",
      "Submitted at: " + data.submitted_at
    ];
    return (
      "mailto:" +
      encodeURIComponent(to) +
      "?subject=" +
      encodeURIComponent(subject) +
      "&body=" +
      encodeURIComponent(lines.join("\n"))
    );
  }
  function onSubmit(ev) {
    ev.preventDefault();
    var form = ev.target;
    var status = dlg.querySelector("#claim-form-status");
    status.className = "claim-status";
    if (!form.reportValidity()) return;
    var missingFollow = false;
    dlg.querySelectorAll(".claim-followed").forEach(function (box) {
      if (!box.checked) missingFollow = true;
    });
    if (missingFollow) {
      status.textContent = "Please follow each official GConf account and tick “I followed”.";
      status.className = "claim-status is-err";
      return;
    }
    if (!form.consent.checked) {
      status.textContent = "Consent to be contacted about this claim is required.";
      status.className = "claim-status is-err";
      return;
    }
    var data = payloadFromForm(form);
    var endpoint = (cfg().claimEndpoint || "").trim();
    var submitBtn = dlg.querySelector("#claim-submit");
    submitBtn.disabled = true;
    if (endpoint) {
      fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data)
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (body) {
            if (!res.ok) throw new Error(body.error || "Could not send the claim.");
            status.textContent = body.message || "Thank you. GConf will review this claim by hand.";
            status.className = "claim-status is-ok";
          });
        })
        .catch(function (err) {
          status.textContent = (err && err.message) || "Could not send the claim. You can email " + contactEmail() + " instead.";
          status.className = "claim-status is-err";
        })
        .finally(function () {
          submitBtn.disabled = false;
        });
      return;
    }
    location.href = mailtoHref(data);
    status.textContent =
      "Your email app should open with the claim filled in. If it does not, write to " +
      contactEmail() +
      ".";
    status.className = "claim-status is-ok";
    submitBtn.disabled = false;
  }

  function open(rec) {
    if (!rec) return;
    if (isVerified(rec.type, rec)) return;
    ensureDialog();
    fillListing(rec);
    document.documentElement.classList.add("claim-open");
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
    var first = dlg.querySelector(".claim-follow-row .btn") || dlg.querySelector(".claim-close");
    if (first) first.focus();
  }
  function close() {
    if (!dlg) return;
    if (dlg.open && typeof dlg.close === "function") dlg.close();
    else dlg.removeAttribute("open");
    document.documentElement.classList.remove("claim-open");
  }
  function bindButton(btn, rec) {
    if (!btn || !rec) return;
    if (isVerified(rec.type, rec)) {
      btn.textContent = "Claimed listing";
      btn.classList.add("is-claimed", "claim-claimed");
      btn.setAttribute("aria-disabled", "true");
      btn.removeAttribute("href");
      if (btn.tagName === "BUTTON") btn.disabled = true;
      btn.onclick = function (ev) {
        ev.preventDefault();
      };
      return;
    }
    btn.onclick = function (ev) {
      ev.preventDefault();
      open(rec);
    };
  }
  function claimSectionHtml(type, rec) {
    var noun = type === "venue" ? "venue" : type === "hotel" ? "hotel" : "event";
    if (isVerified(type, rec)) {
      return (
        '<div class="dsec claim"><h4>Organisers</h4>' +
        "<p>This " +
        noun +
        " listing has been verified by the organiser.</p>" +
        '<div class="cta-row"><button type="button" class="btn claim-claimed" disabled>Claimed listing</button></div></div>'
      );
    }
    return (
      '<div class="dsec claim"><h4>Organisers</h4>' +
      "<p>This listing is researched from public sources. If you run this " +
      noun +
      ", you can claim it and correct the record. GConf reviews claims by hand. Follows and a repost of the listing are used to verify the claim.</p>" +
      '<div class="cta-row"><button type="button" class="btn primary xl claim-cta" data-claim-type="' +
      esc(type) +
      '" data-claim-slug="' +
      esc(rec.slug || hotelSlug(rec)) +
      '">Claim this listing</button></div></div>'
    );
  }

  global.GCONFCLAIM = {
    SOCIALS: SOCIALS,
    CONTACT_EMAIL: CONTACT_EMAIL,
    SITE: SITE,
    open: open,
    close: close,
    bindButton: bindButton,
    isVerified: isVerified,
    verifiedInfo: verifiedInfo,
    badgeHtml: badgeHtml,
    claimSectionHtml: claimSectionHtml,
    listingCanonical: listingCanonical,
    hotelSlug: hotelSlug,
    placeSlug: placeSlug
  };

  document.addEventListener("click", function (ev) {
    var btn = ev.target.closest && ev.target.closest("[data-claim-type]");
    if (!btn || btn.classList.contains("is-claimed") || btn.disabled) return;
    ev.preventDefault();
    var type = btn.getAttribute("data-claim-type");
    var rec = {
      type: type,
      slug: btn.getAttribute("data-claim-slug") || "",
      name: btn.getAttribute("data-claim-name") || "",
      country: btn.getAttribute("data-claim-country") || "",
      city: btn.getAttribute("data-claim-city") || "",
      canonical: btn.getAttribute("data-claim-url") || ""
    };
    open(rec);
  });
})(window);

"use client";

import { useState } from "react";
import Image from "next/image";
import dealerIcon from "@/styles/psb_dealer_icon.svg";
import "../dealerPortal.css";

const ACCOUNT_NAV = [
  { key: "overview", label: "Overview" },
  { key: "company", label: "Company" },
  { key: "contacts", label: "Contacts" },
  { key: "address", label: "Address" },
  { key: "security", label: "Login & security" },
];

// Planned sections. Shown so dealers know they are coming; not selectable yet.
const LATER_NAV = ["Orders", "Quotes", "Invoices", "Documents"];

function initialsOf(value) {
  const text = String(value ?? "").trim();
  if (!text) return "DA";
  const parts = text.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "DA";
}

/**
 * Frame for the signed-in dealer area: header, side menu and the dealer
 * identity strip. `active` is the current section key and `onSelect(key)`
 * switches section; nothing here navigates to another page except Logout.
 */
export default function DealerShell({ dealer, username, active, onSelect, children }) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch("/api/dealer/logout", { method: "POST" });
    } finally {
      window.location.assign("/dealer/login");
    }
  }

  const isSupport = active === "support";

  return (
    <div className="dp-app">
      <header className="dp-header">
        <div className="dp-header-left">
          <Image src={dealerIcon} alt="" className="dp-logo" />
          <div className="dp-title">PSBUniverse</div>
          <div className="dp-subtitle">Dealer Portal</div>
          <nav className="dp-tabs" aria-label="Dealer portal tabs">
            <button type="button" className={`dp-tab${isSupport ? "" : " is-active"}`} onClick={() => onSelect?.("overview")}>
              My Account
            </button>
            <button type="button" className={`dp-tab${isSupport ? " is-active" : ""}`} onClick={() => onSelect?.("support")}>
              Contact PSB
            </button>
          </nav>
        </div>

        <div className="dp-user">
          <div className="dp-who-meta">Signed in as <span className="dp-mono">{username}</span></div>
          <button type="button" className="dp-logout" onClick={handleLogout} disabled={signingOut}>
            {signingOut ? "Signing out..." : "Logout"}
          </button>
        </div>
      </header>

      <div className="dp-shell">
        <aside className="dp-side">
          <nav className="dp-nav" aria-label="Account sections">
            <div className="dp-nav-title">Account</div>
            {ACCOUNT_NAV.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`dp-nav-item${active === item.key ? " is-active" : ""}`}
                aria-current={active === item.key ? "page" : undefined}
                onClick={() => onSelect?.(item.key)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <nav className="dp-nav" aria-label="Business">
            <div className="dp-nav-title">Business</div>
            {LATER_NAV.map((label) => (
              <span key={label} className="dp-nav-item is-later">
                {label} <span className="dp-nav-tag">Later</span>
              </span>
            ))}
          </nav>

          <nav className="dp-nav" aria-label="Help">
            <div className="dp-nav-title">Help</div>
            <button
              type="button"
              className={`dp-nav-item${isSupport ? " is-active" : ""}`}
              aria-current={isSupport ? "page" : undefined}
              onClick={() => onSelect?.("support")}
            >
              Contact PSB
            </button>
          </nav>

          <div className="dp-side-foot">
            <strong>Premium Steel Buildings Inc.</strong>
            Dealer accounts are set up by PSB staff.
          </div>
        </aside>

        <div className="dp-main">
          <div className="dp-identity">
            <div className="dp-who">
              <div className="dp-avatar" aria-hidden="true">{initialsOf(dealer?.dealer_name)}</div>
              <div>
                <div className="dp-who-name">{dealer?.dealer_name || "Dealer account"}</div>
                <div className="dp-who-meta">
                  Dealer <span className="dp-chip">{dealer?.dealer_code || "--"}</span> · signed in as <span className="dp-mono">{username}</span>
                </div>
              </div>
            </div>
            <span className="dp-pill dp-pill-good">Active dealer</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Eduardo and his team use the product to manage personal finances and service-related money in a shared operational routine.

## Product Purpose

Financeiro Eduardo helps the team register, review, and separate daily financial movement across personal cash flow and service work. Success means the user can quickly understand what came in, what went out, what is pending, what belongs to services, and what remains available without mixing personal and professional amounts.

## Positioning

The product is a small, direct finance system shaped around Eduardo's real workflow: personal finance and service finance stay separate, while the same app still supports daily cash-flow checks, reports, and operational control.

## Operating Context

The app runs as a responsive web/PWA interface served by Cloudflare Workers with D1 storage, and also ships as an Electron Windows executable. Users work with monthly dashboards, transaction lists, service movements, categories, accounts/wallets, transfers, filters, CSV export, and status tracking.

## Capabilities and Constraints

Confirmed capabilities include personal transactions, service transactions, status tracking, editable categories, accounts/wallets, transfers, recurring/monthly installments, dashboards, filters, search, CSV export, PWA installability, Electron packaging, Cloudflare Worker API, and D1 persistence.

Future changes must preserve the current simplicity, keep PWA/Electron behavior reliable, and migrate existing D1 data without deleting or recreating user data.

## Brand Commitments

The product name is Financeiro Eduardo. The interface should stay practical, clear, and work-focused for a small team rather than becoming a generic finance SaaS.

## Evidence on Hand

Repository evidence includes `README.md`, `package.json`, `src/index.js`, `schema.sql`, `public/`, and `desktop/main.cjs`. No external brand kit, logo package, customer testimonials, pricing, or legal copy are present in the repository.

## Product Principles

- Keep personal finance and service finance clearly separated.
- Make daily cash-flow review fast and low-friction.
- Prefer simple operational screens over marketing-style presentation.
- Preserve existing data through additive migrations.
- Keep installed/PWA/Electron users from seeing stale versions.

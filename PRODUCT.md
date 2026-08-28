# Product

<!-- impeccable:product-schema 1 -->

## Platform

Web, PWA and Windows desktop.

## Users

CENGTEC team members use individual profiles in one shared company application.

## Product Purpose

Financeiro CENGTEC separates private profile finances from shared service operations. Each profile controls its own cash flow, while the whole authenticated team works from one common service ledger.

## Data Visibility

- Overview, transactions, accounts, categories, budgets, balances and personal reports are private to the authenticated profile.
- Services, clients, service revenue, service costs, contracts and service status are shared across all authenticated profiles.
- Shared service amounts never affect a profile's private Overview balance.

## Operating Context

The app runs through Cloudflare Workers and D1, with responsive web/PWA clients and a portable Electron executable for Windows.

## Capabilities and Constraints

Confirmed capabilities include authentication, private personal transactions, shared service transactions, editable categories, accounts, transfers, recurring installments, dashboards, filters, CSV export, JSON backup, PWA installation and Electron packaging.

Future changes must preserve data visibility boundaries, keep web/PWA/Electron behavior reliable, and migrate existing D1 data without deleting or recreating user data.

## Brand Commitments

The product name is Financeiro CENGTEC. The official CENGTEC logo is stored in `public/cengtec-logo.jpg`, extracted from the company receipt supplied for the v0.4.0 rebrand.

## Product Principles

- Keep each profile's Overview private.
- Keep Services shared between authenticated profiles.
- Never mix service amounts into personal balances.
- Prefer simple operational screens.
- Preserve existing data through additive migrations.
- Prevent stale PWA and Electron assets.

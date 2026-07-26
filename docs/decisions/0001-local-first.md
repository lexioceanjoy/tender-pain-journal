# ADR 0001: Local-first data for the first release

## Decision

Store entries on the current device in IndexedDB. Provide export and import for backup. Do not build accounts or cloud sync in the first release.

## Why

This gives the person immediate privacy and offline use, avoids account/security infrastructure, and keeps the first release focused on reliable daily logging.

## Consequence

Data does not automatically appear on another device. The app must make backup/export clear and easy. The data layer will remain separate from the user interface so a future sync service can be added deliberately.

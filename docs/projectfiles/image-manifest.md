# Image manifest

**Status: option A chosen (2026-10-29).** 32 of the 36 images below were sourced and are in `src/main/resources/static/images/`; the 4 not found are `unit-045-townhouse-4-01`, `unit-050-shop-3-01`, `unit-072-shop-c-01` and `unit-077-booth-2-01` (those units show the layout instead). Credits: `image-credits.md`. Avatars: not wanted.

Background: the app can show photos, but only files **uploaded through the app** (rows in `uploaded_files`, bytes in the git-ignored `uploads/` folder). A fresh clone has none, so demo photos need one of the options below. The file names and the list do not change with the option. Avatars are **not** in this list: no page shows a user picture today (see the question at the end).

## Where the app shows photos today

| Place | What it shows | Source |
|---|---|---|
| Homepage cards and the details window | The property's cover (first PROPERTY_PHOTO) | `PropertyListing.coverPhotoUrl` -> `/api/files/{id}` |
| Landlord dashboard cards and the property modal header | The property's cover | `Property.coverPhotoUrl` |
| Units page | Each unit's photos (UNIT_PHOTO) | `/api/units/{id}/files` |
| Renter dashboard lease card | The unit's first photo, else the layout | `LeaseContract.imageUrl` |
| Property form | All property photos and the site plan | `/api/properties/{id}/files` |

Not shown anywhere: user avatars, gallery slideshows (the homepage uses only the first photo, so extra gallery photos only appear on the property form).

## Naming (all lowercase, hyphens, zero-padded numbers, `.jpg`)

- `property-<id, 2 digits>-<slug>-cover.jpg` and `property-<id>-<slug>-<nn>.jpg` (gallery)
- `unit-<id, 3 digits>-<slug>-<nn>.jpg`
- `avatar-<username>.jpg` (only if avatars are approved)

## Count and why

Total **36** images: 16 covers (every property gets a card, including the drafts and the five sample properties, so no card is blank), 8 gallery photos (four showcase properties) and 12 unit photos (the units a renter sees on the dashboard and the units a landlord edits in the demo). That is enough to make every screen look real without sourcing hundreds of pictures.

## Manifest

| # | filename | category | entity (id and name) | what the photo should show | orientation and minimum size |
|---|---|---|---|---|---|
| 1 | `property-01-spacegrid-suites-bajada-cover.jpg` | Property cover | Property 1: SpaceGrid Suites Bajada | Two-floor apartment building exterior near Victoria Plaza, Davao City, with a garden | landscape 4:3 (or 16:10), at least 1200 x 900 px |
| 2 | `property-02-matina-enclave-residences-cover.jpg` | Property cover | Property 2: Matina Enclave Residences | Mid-rise condominium building exterior along MacArthur Highway | landscape 4:3 (or 16:10), at least 1200 x 900 px |
| 3 | `property-03-agdao-market-stalls-cover.jpg` | Property cover | Property 3: Agdao Market Stalls | Ground-floor market stalls with customer parking | landscape 4:3 (or 16:10), at least 1200 x 900 px |
| 4 | `property-04-roxas-night-market-section-c-cover.jpg` | Property cover | Property 4: Roxas Night Market - Section C | Evening night market, covered walkway lit with booths | landscape 4:3 (or 16:10), at least 1200 x 900 px |
| 5 | `property-05-magsaysay-open-plaza-cover.jpg` | Property cover | Property 5: Magsaysay Open Plaza | Open park plaza with grass and space for pop-up stalls | landscape 4:3 (or 16:10), at least 1200 x 900 px |
| 6 | `property-06-lanang-bayview-apartments-cover.jpg` | Property cover | Property 6: Lanang Bayview Apartments | Two-storey apartment building exterior with parking | landscape 4:3 (or 16:10), at least 1200 x 900 px |
| 7 | `property-07-ecoland-garden-condominium-cover.jpg` | Property cover | Property 7: Ecoland Garden Condominium | Condominium tower with landscaped garden | landscape 4:3 (or 16:10), at least 1200 x 900 px |
| 8 | `property-08-buhangin-townhomes-row-cover.jpg` | Property cover | Property 8: Buhangin Townhomes Row | Row of small townhouses with a shared driveway | landscape 4:3 (or 16:10), at least 1200 x 900 px |
| 9 | `property-09-bolton-commercial-arcade-cover.jpg` | Property cover | Property 9: Bolton Commercial Arcade | Street-level shop arcade with a covered walkway | landscape 4:3 (or 16:10), at least 1200 x 900 px |
| 10 | `property-10-toril-weekend-night-bazaar-cover.jpg` | Property cover | Property 10: Toril Weekend Night Bazaar | Weekend night bazaar with lit stalls and visitors | landscape 4:3 (or 16:10), at least 1200 x 900 px |
| 11 | `property-11-sta-ana-wharf-open-lot-cover.jpg` | Property cover | Property 11: Sta. Ana Wharf Open Lot | Empty open lot beside a wharf | landscape 4:3 (or 16:10), at least 1200 x 900 px |
| 12 | `property-12-catalunan-pequeno-duplex-cover.jpg` | Property cover | Property 12: Catalunan Pequeno Duplex | Duplex house exterior, unfinished or newly built look | landscape 4:3 (or 16:10), at least 1200 x 900 px |
| 13 | `property-13-matina-town-center-shops-cover.jpg` | Property cover | Property 13: Matina Town Center Shops | Row of small commercial shops on a busy street | landscape 4:3 (or 16:10), at least 1200 x 900 px |
| 14 | `property-14-magallanes-street-night-food-market-cover.jpg` | Property cover | Property 14: Magallanes Street Night Food Market | Street food market at night with booths | landscape 4:3 (or 16:10), at least 1200 x 900 px |
| 15 | `property-15-davao-riverside-events-lawn-cover.jpg` | Property cover | Property 15: Davao Riverside Events Lawn | Wide lawn by a river, suitable for events | landscape 4:3 (or 16:10), at least 1200 x 900 px |
| 16 | `property-16-maa-starter-apartments-cover.jpg` | Property cover | Property 16: Maa Starter Apartments | Small low-rise apartment building | landscape 4:3 (or 16:10), at least 1200 x 900 px |
| 17 | `property-06-lanang-bayview-apartments-01.jpg` | Property gallery | Property 6 | Hallway or shared garden of the apartment building (photo 1 of 2) | landscape 4:3, at least 1200 x 900 px |
| 18 | `property-06-lanang-bayview-apartments-02.jpg` | Property gallery | Property 6 | Hallway or shared garden of the apartment building (photo 2 of 2) | landscape 4:3, at least 1200 x 900 px |
| 19 | `property-07-ecoland-garden-condominium-01.jpg` | Property gallery | Property 7 | Condominium lobby or corridor (photo 1 of 2) | landscape 4:3, at least 1200 x 900 px |
| 20 | `property-07-ecoland-garden-condominium-02.jpg` | Property gallery | Property 7 | Condominium lobby or corridor (photo 2 of 2) | landscape 4:3, at least 1200 x 900 px |
| 21 | `property-09-bolton-commercial-arcade-01.jpg` | Property gallery | Property 9 | Inside a shop: counter and shelves (photo 1 of 2) | landscape 4:3, at least 1200 x 900 px |
| 22 | `property-09-bolton-commercial-arcade-02.jpg` | Property gallery | Property 9 | Inside a shop: counter and shelves (photo 2 of 2) | landscape 4:3, at least 1200 x 900 px |
| 23 | `property-13-matina-town-center-shops-01.jpg` | Property gallery | Property 13 | Shop front with signage (photo 1 of 2) | landscape 4:3, at least 1200 x 900 px |
| 24 | `property-13-matina-town-center-shops-02.jpg` | Property gallery | Property 13 | Shop front with signage (photo 2 of 2) | landscape 4:3, at least 1200 x 900 px |
| 25 | `unit-021-a101-01.jpg` | Unit photo | Unit 21: A101 (Lanang Bayview Apartments) | Bright apartment unit interior (living area) | landscape 4:3, at least 1000 x 750 px |
| 26 | `unit-022-a102-01.jpg` | Unit photo | Unit 22: A102 (Lanang Bayview Apartments) | Apartment unit interior with small kitchen | landscape 4:3, at least 1000 x 750 px |
| 27 | `unit-024-a104-01.jpg` | Unit photo | Unit 24: A104 (Lanang Bayview Apartments) | Small apartment unit interior, bedroom | landscape 4:3, at least 1000 x 750 px |
| 28 | `unit-033-5a-01.jpg` | Unit photo | Unit 33: 5A (Ecoland Garden Condominium) | Condominium unit living room with window | landscape 4:3, at least 1000 x 750 px |
| 29 | `unit-034-5b-01.jpg` | Unit photo | Unit 34: 5B (Ecoland Garden Condominium) | Condominium unit bedroom | landscape 4:3, at least 1000 x 750 px |
| 30 | `unit-042-townhouse-1-01.jpg` | Unit photo | Unit 42: Townhouse 1 (Buhangin Townhomes Row) | Townhouse front or living area | landscape 4:3, at least 1000 x 750 px |
| 31 | `unit-043-townhouse-2-01.jpg` | Unit photo | Unit 43: Townhouse 2 (Buhangin Townhomes Row) | Townhouse living area and stairs | landscape 4:3, at least 1000 x 750 px |
| 32 | `unit-045-townhouse-4-01.jpg` | Unit photo | Unit 45: Townhouse 4 (Buhangin Townhomes Row) | Small townhouse exterior | landscape 4:3, at least 1000 x 750 px |
| 33 | `unit-050-shop-3-01.jpg` | Unit photo | Unit 50: Shop 3 (Bolton Commercial Arcade) | Empty retail shop space, glass front | landscape 4:3, at least 1000 x 750 px |
| 34 | `unit-072-shop-c-01.jpg` | Unit photo | Unit 72: Shop C (Matina Town Center Shops) | Corner shop interior | landscape 4:3, at least 1000 x 750 px |
| 35 | `unit-076-booth-1-01.jpg` | Unit photo | Unit 76: Booth 1 (Magallanes Street Night Food Market) | Night-market food booth with lights | landscape 4:3, at least 1000 x 750 px |
| 36 | `unit-077-booth-2-01.jpg` | Unit photo | Unit 77: Booth 2 (Magallanes Street Night Food Market) | Night-market booth, empty, ready to rent | landscape 4:3, at least 1000 x 750 px |

## Decision (made)

1. **How demo photos reach a fresh clone.** Chosen: **A**. The options were:
   - **A (recommended by the plan): no DB change.** Put the files under `src/main/resources/static/images/properties/` and `.../units/`. The model finds a photo by naming convention when there is no uploaded one (small change in `Property.getCoverPhotoUrl`, `LeaseContract.getImageUrl`, `PropertyListing` and the units page). Uploaded photos still win.
   - **B: seed rows.** Insert `uploaded_files` rows with `stored_name = 'property-06-...-cover.jpg'` and add a fallback in `FileService` that reads `static/images/` when the file is not in `uploads/`. No page changes, and the permission rules keep working, but the SQL script gets about 36 more rows.
   - **C: copy by hand.** Leave the app alone; each person uploads the photos through the pages. Least code, but the demo has no photos until someone does it.
2. **Avatars.** Not wanted, so nothing was added.

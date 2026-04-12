# Rivertowns Custom Creaions

Static storefront for a custom product shop. The first product is a custom mug:

- Base mug price: `$20`
- Pick up at Slices: `+$1`
- Delivery to house: `+$5`
- Customers can upload an image and preview it on the mug

## Run locally

Serve the folder with any static server:

- `python3 -m http.server 8000`
- Open `http://localhost:8000`

## Publish as a public website

Because the site is plain `HTML`, `CSS`, and `JavaScript`, you can publish files like `index.html`, `zevs-custom-creations.css`, and `zevs-custom-creations.js` on any static host.

### GitHub Pages

1. Create a GitHub repository and upload the files in this folder.
2. In the repository settings, open `Pages`.
3. Set the source to deploy from your main branch.
4. GitHub will give you a public URL.

### Netlify or Vercel

1. Create a new project from this folder or from a GitHub repository.
2. Use the default static-site settings.
3. Deploy and they will generate a public URL.

## Notes

- Stripe Checkout and the backend are now connected for online payments.
- The site still needs real image storage if you want to keep uploaded files with paid orders.
- More products can be added by duplicating the product card and expanding the form logic.

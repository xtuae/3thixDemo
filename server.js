/*
  This is an example of a Node.js server using the Express framework.
  You would run this on your server, not in the browser.

  To use this:
  1. Make sure you have Node.js installed.
  2. Create a new folder, `cd` into it.
  3. Run: `npm init -y`
  4. Run: `npm install express node-fetch`
  5. Save this file as `server.js`.
  6. Save the `payment.html` file in the same folder.
  7. Run: `node server.js`
  8. Open `http://localhost:3000/` in your browser.
*/

require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();

// This is your SECRET API KEY.
// In a real app, you'd store this in an environment variable (e.g., process.env.THIX_API_KEY)
const THIX_API_KEY = process.env.THIX_API_KEY;
const THIX_API_URL = "https://sandbox-api.3thix.com/order/payment/create";

// Middleware to parse JSON bodies and serve static files
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Serve the HTML page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'payment.html'));
});

// This is the secure endpoint your JQuery will call
app.post('/create-payment-invoice', async (req, res) => {
    console.log("Received request to create invoice:", req.body);

    // TODO: You must add a 'user_entity_id' based on the logged-in user.
    // This ID comes from the 3thix /entity/game/user/autosync endpoint.
    // For this example, I am hardcoding a placeholder.
    // This ID comes from the 3thix /entity/game/user/autosync endpoint.
    const userEntityId = "084hCSojRQ097trn";

    const { description, amount, currency, merchant_ref_id } = req.body;

    const apiPayload = {
        invoice: {
            description: description,
            amount: amount.toString(),
        },
        currency: currency,
        merchant_ref_id: merchant_ref_id,
        user_entity_id: userEntityId,
    };

    console.log("Sending payload to 3thix API:", JSON.stringify(apiPayload, null, 2));

    try {
        const response = await fetch(THIX_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': THIX_API_KEY // The key is used safely on the server
            },
            body: JSON.stringify(apiPayload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("3thix API Error:", data);
            throw new Error(data.message || 'Failed to create invoice');
        }

        // IMPORTANT: I am guessing the response structure.
        // Check the 3thix documentation for the exact response.
        // Let's assume the invoice ID is at `data.invoice_id` or `data.invoice.id`
        // For this example, let's check for common structures.
        const invoiceId = data.invoice_id || data.invoice?.id || data.id;

        if (!invoiceId) {
            console.error("Could not find invoiceId in 3thix response:", data);
            return res.status(500).json({ error: "Could not parse invoice ID from 3thix" });
        }

        console.log("Successfully created invoice. Sending ID to frontend:", invoiceId);
        
        // Send *only* the invoiceId back to the frontend
        res.status(200).json({ invoiceId: invoiceId });

    } catch (error) {
        console.error("Error calling 3thix API:", error);
        res.status(500).json({ error: error.message });
    }
});

// Export the app for Vercel
module.exports = app;

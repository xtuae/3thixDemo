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
const { v4: uuidv4 } = require('uuid');

const app = express();

// This is your SECRET API KEY.
// In a real app, you'd store this in an environment variable (e.g., process.env.THIX_API_KEY)
const THIX_API_KEY = process.env.THIX_API_KEY;

if (!THIX_API_KEY) {
    console.error("FATAL ERROR: THIX_API_KEY is not defined. Please set it in your environment variables.");
    process.exit(1);
}
const THIX_API_URL = "https://sandbox-api.3thix.com/order/payment/create";
const THIX_AUTOSYNC_URL = "https://sandbox-api.3thix.com/entity/game/user/autosync";

async function getOrCreateUserEntityId() {
    // For this demo, we'll use a constant third_party_id to simulate a single user.
    // In a real application, this would be the logged-in user's ID.
    const thirdPartyId = "demo-user-123";
    try {
        const response = await fetch(THIX_AUTOSYNC_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': THIX_API_KEY
            },
            body: JSON.stringify({
                users: [{
                    third_party_id: thirdPartyId,
                    first_name: "John",
                    last_name: "Doe",
                    email: `${thirdPartyId}@example.com`,
                    phone: "+1234567890"
                }]
            })
        });

        const data = await response.json();
        if (!response.ok) {
            console.error("3thix API Error (autosync):", data);
            throw new Error(data.message || 'Failed to create or sync user');
        }

        // The API returns both created and existing entities.
        // We can look in both arrays to find our entity_id.
        const user = data.entities_created.find(u => u.third_party_id === thirdPartyId) ||
                     data.entities_existing.find(u => u.third_party_id === thirdPartyId);

        if (user && user.entity_id) {
            return user.entity_id;
        } else {
            console.error("Could not find entity_id in 3thix autosync response:", data);
            throw new Error("Could not parse entity_id from 3thix");
        }
    } catch (error) {
        console.error("Error in getOrCreateUserEntityId:", error);
        throw error; // Re-throw the error to be caught by the endpoint's catch block
    }
}

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

    const { description, amount, currency, merchant_ref_id } = req.body;

    try {
        const userEntityId = await getOrCreateUserEntityId();

        const apiPayload = {
            invoice: {
                description: description,
                amount: amount.toString(),
            },
            currency: currency,
            merchant_ref_id: merchant_ref_id,
            user_entity_id: userEntityId,
        };

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
        console.error("Error in /create-payment-invoice endpoint:", error);
        res.status(500).json({ error: "An internal server error occurred.", details: error.message });
    }
});

// Export the app for Vercel
module.exports = app;

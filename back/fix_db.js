const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Lead = require('./models/Lead');
const { parsePhoneNumberFromString } = require('libphonenumber-js');

dotenv.config();

async function fix() {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Fix Users
    const users = await User.find();
    for (let u of users) {
        const parsed = parsePhoneNumberFromString(u.telefonoCompleto);
        if (parsed) {
            u.codigoPais = `+${parsed.countryCallingCode}`;
            await u.save();
        }
    }
    
    // Fix Leads
    const leads = await Lead.find();
    for (let l of leads) {
        const parsed = parsePhoneNumberFromString(l.telefono);
        if (parsed) {
            l.codigoPais = `+${parsed.countryCallingCode}`;
            await l.save();
        }
    }
    
    console.log('Fixed country codes!');
    process.exit(0);
}
fix();

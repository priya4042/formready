/* Exam upload sizes. Where guides disagree the preset uses the range that satisfies all of them.
   Always checked against the latest official notification by the user - the page says so. */
window.FR_EXAMS = [
  { id: "ssc", en: "SSC (CGL, CHSL, MTS, GD, CPO)", hi: "SSC (CGL, CHSL, MTS, GD, CPO)",
    note: ["Some SSC forms now take the photo live from your camera. Use these files where an upload is asked.", "कुछ SSC फ़ॉर्म में फ़ोटो अब कैमरे से सीधे ली जाती है। जहाँ फ़ाइल माँगी जाए वहाँ इन्हें इस्तेमाल करें।"],
    docs: [
      { id: "photo", en: "Photo", hi: "फ़ोटो", w: 200, h: 230, min: 20, max: 50 },
      { id: "sign", en: "Signature", hi: "हस्ताक्षर", w: 140, h: 60, min: 10, max: 20, ink: true }
    ] },
  { id: "ibps", en: "IBPS / SBI bank exams (PO, Clerk, RRB)", hi: "IBPS / SBI बैंक परीक्षा (PO, Clerk, RRB)",
    docs: [
      { id: "photo", en: "Photo", hi: "फ़ोटो", w: 200, h: 230, min: 20, max: 50 },
      { id: "sign", en: "Signature", hi: "हस्ताक्षर", w: 140, h: 60, min: 10, max: 20, ink: true },
      { id: "thumb", en: "Left thumb impression", hi: "बाएँ अंगूठे का निशान", w: 240, h: 240, min: 20, max: 50, ink: true },
      { id: "decl", en: "Handwritten declaration", hi: "हस्तलिखित घोषणा", w: 800, h: 400, min: 50, max: 100, ink: true }
    ] },
  { id: "upsc", en: "UPSC (CSE, NDA, CDS, CAPF)", hi: "UPSC (CSE, NDA, CDS, CAPF)",
    note: ["UPSC accepts 350 to 1000 px square. Some notices ask you to sign three times, one below the other.", "UPSC में 350 से 1000 px वर्गाकार चलता है। कुछ नोटिस में तीन बार हस्ताक्षर, एक के नीचे एक, माँगे जाते हैं।"],
    docs: [
      { id: "photo", en: "Photo", hi: "फ़ोटो", w: 550, h: 550, min: 20, max: 200 },
      { id: "sign", en: "Signature", hi: "हस्ताक्षर", w: 550, h: 550, min: 20, max: 100, ink: true }
    ] },
  { id: "neet", en: "NTA NEET UG", hi: "NTA NEET UG",
    note: ["NEET asks for a recent colour photo with a white background. The postcard photo is 4 x 6 inch.", "NEET में हाल की रंगीन फ़ोटो, सफ़ेद बैकग्राउंड के साथ चाहिए। पोस्टकार्ड फ़ोटो 4 x 6 इंच की होती है।"],
    docs: [
      { id: "photo", en: "Passport photo", hi: "पासपोर्ट फ़ोटो", w: 350, h: 450, min: 10, max: 200 },
      { id: "post", en: "Postcard photo (4 x 6 in)", hi: "पोस्टकार्ड फ़ोटो (4 x 6 इंच)", w: 800, h: 1200, min: 10, max: 200 },
      { id: "sign", en: "Signature", hi: "हस्ताक्षर", w: 350, h: 150, min: 10, max: 30, ink: true },
      { id: "thumb", en: "Left thumb impression", hi: "बाएँ अंगूठे का निशान", w: 300, h: 300, min: 10, max: 200, ink: true }
    ] },
  { id: "jee", en: "NTA JEE Main / CUET", hi: "NTA JEE Main / CUET",
    docs: [
      { id: "photo", en: "Photo", hi: "फ़ोटो", w: 350, h: 450, min: 10, max: 200 },
      { id: "sign", en: "Signature", hi: "हस्ताक्षर", w: 350, h: 150, min: 4, max: 30, ink: true }
    ] },
  { id: "rrb", en: "Railway RRB (NTPC, Group D, ALP)", hi: "रेलवे RRB (NTPC, Group D, ALP)",
    note: ["Newer RRB forms capture the photo live. Signature limits change between notices, so check yours.", "नए RRB फ़ॉर्म में फ़ोटो कैमरे से ली जाती है। हस्ताक्षर की सीमा हर नोटिस में बदलती है, अपना नोटिस देखें।"],
    docs: [
      { id: "photo", en: "Photo (35 x 45 mm)", hi: "फ़ोटो (35 x 45 mm)", w: 276, h: 354, min: 20, max: 50 },
      { id: "sign", en: "Signature", hi: "हस्ताक्षर", w: 140, h: 60, min: 10, max: 40, ink: true }
    ] },
  { id: "custom", en: "Custom size", hi: "अपना साइज़",
    docs: [
      { id: "photo", en: "Photo", hi: "फ़ोटो", w: 300, h: 400, min: 20, max: 50 },
      { id: "sign", en: "Signature", hi: "हस्ताक्षर", w: 300, h: 100, min: 10, max: 20, ink: true },
      { id: "square", en: "Square image", hi: "वर्गाकार इमेज", w: 500, h: 500, min: 20, max: 100 }
    ] }
];

// Built-in reference catalogs of inputs commonly available in Nigeria.
// These are quick-add helpers — the farmer can still type their own and set real prices.

export type FertilizerCatalogItem = {
  name: string;
  category: "NPK" | "urea" | "organic" | "foliar" | "calcium" | "potassium" | "other";
  nutrientFocus: string;
};

export const FERTILIZER_CATALOG: FertilizerCatalogItem[] = [
  { name: "NPK 20-20-20", category: "NPK", nutrientFocus: "Balanced N-P-K" },
  { name: "NPK 15-15-15", category: "NPK", nutrientFocus: "Balanced N-P-K" },
  { name: "NPK 20-10-10", category: "NPK", nutrientFocus: "High nitrogen" },
  { name: "NPK 12-12-17+2MgO", category: "NPK", nutrientFocus: "Potassium + magnesium" },
  { name: "Calcium Nitrate", category: "calcium", nutrientFocus: "Calcium + nitrogen" },
  { name: "6-13-46 (MKP foliar)", category: "potassium", nutrientFocus: "Potassium + phosphorus (fruiting)" },
  { name: "Calcium + Magnesium", category: "calcium", nutrientFocus: "Calcium + magnesium" },
  { name: "Boron", category: "foliar", nutrientFocus: "Boron (flowering/fruit set)" },
  { name: "Calcium + Boron", category: "foliar", nutrientFocus: "Calcium + boron" },
  { name: "MOP (Muriate of Potash)", category: "potassium", nutrientFocus: "Potassium" },
  { name: "SOP (Sulphate of Potash)", category: "potassium", nutrientFocus: "Potassium + sulphur" },
  { name: "DAP (Di-ammonium Phosphate)", category: "NPK", nutrientFocus: "Phosphorus + nitrogen (basal)" },
  { name: "Urea", category: "urea", nutrientFocus: "Nitrogen (top dressing)" },
  { name: "Poultry/Organic manure", category: "organic", nutrientFocus: "Organic matter, soil conditioning" }
];

export type ProtectionCategory = "insecticide" | "fungicide" | "herbicide" | "nematicide" | "miticide";

export type ProtectionCatalogItem = {
  name: string;
  category: ProtectionCategory;
  target: string;
};

// Grouped list of crop-protection products commonly sold in Nigeria.
export const PROTECTION_CATALOG: ProtectionCatalogItem[] = [
  // Insecticides
  { name: "Rocket (profenofos + cypermethrin)", category: "insecticide", target: "Caterpillars, aphids, bollworm" },
  { name: "Cypercal / Cyperforce (cypermethrin)", category: "insecticide", target: "Chewing & sucking insects" },
  { name: "Lara Force / Lambda (lambda-cyhalothrin)", category: "insecticide", target: "Whitefly, thrips, beetles" },
  { name: "Karate (lambda-cyhalothrin)", category: "insecticide", target: "Caterpillars, beetles" },
  { name: "Magic Force / Best (acetamiprid + cypermethrin)", category: "insecticide", target: "Whitefly, aphids" },
  { name: "Confidor (imidacloprid)", category: "insecticide", target: "Whitefly, aphids, hoppers" },
  { name: "Punch (insecticide)", category: "insecticide", target: "Sucking & chewing pests" },
  { name: "Blue Snow", category: "insecticide", target: "Sucking pests / mites" },
  { name: "Worm Force", category: "insecticide", target: "Armyworm, leaf worms" },
  { name: "Belt (flubendiamide)", category: "insecticide", target: "Fall armyworm, borers" },
  { name: "Ampligo (chlorantraniliprole + lambda)", category: "insecticide", target: "Armyworm, caterpillars" },
  { name: "Nurelle-D (chlorpyrifos + cypermethrin)", category: "insecticide", target: "Broad-spectrum insects" },
  { name: "Neem oil (botanical)", category: "insecticide", target: "Whitefly, aphids, mites (light pressure)" },
  // Miticides
  { name: "Oberon (spiromesifen)", category: "miticide", target: "Red spider mites, whitefly" },
  { name: "Abamectin", category: "miticide", target: "Mites, leafminers" },
  // Fungicides
  { name: "Saaf (carbendazim + mancozeb)", category: "fungicide", target: "Blight, leaf spot, damping off" },
  { name: "Ridomil Gold (metalaxyl + mancozeb)", category: "fungicide", target: "Downy mildew, late blight" },
  { name: "Mancozeb (Z-Force / Dithane)", category: "fungicide", target: "Leaf spot, blight (protectant)" },
  { name: "Carbendazim", category: "fungicide", target: "Wilt, anthracnose" },
  { name: "Antracol (propineb)", category: "fungicide", target: "Blights, leaf spots" },
  { name: "Funguran / Kocide (copper)", category: "fungicide", target: "Bacterial spot, blight" },
  { name: "Topsin-M (thiophanate-methyl)", category: "fungicide", target: "Powdery mildew, blight" },
  // Herbicides
  { name: "Force Up (glyphosate)", category: "herbicide", target: "Non-selective knockdown (pre-clearing)" },
  { name: "Round Up (glyphosate)", category: "herbicide", target: "Non-selective knockdown" },
  { name: "Slasher (glyphosate)", category: "herbicide", target: "Non-selective knockdown" },
  { name: "Sarosate / Touchdown (glyphosate)", category: "herbicide", target: "Non-selective knockdown" },
  { name: "Gramoxone / Paraquat", category: "herbicide", target: "Fast contact burn-down" },
  { name: "Primextra / Atra-Force (atrazine)", category: "herbicide", target: "Pre-emergence (maize)" },
  { name: "2,4-D Amine", category: "herbicide", target: "Broadleaf weeds (cereals)" },
  // Nematicides
  { name: "Vydate (oxamyl)", category: "nematicide", target: "Root-knot nematodes" },
  { name: "Mocap (ethoprophos)", category: "nematicide", target: "Soil nematodes" },
  { name: "Neem cake", category: "nematicide", target: "Nematode suppression (organic)" }
];

export const PROTECTION_GROUPS: { category: ProtectionCategory; label: string }[] = [
  { category: "insecticide", label: "Insecticides" },
  { category: "miticide", label: "Miticides / acaricides" },
  { category: "fungicide", label: "Fungicides" },
  { category: "herbicide", label: "Herbicides" },
  { category: "nematicide", label: "Nematicides" }
];

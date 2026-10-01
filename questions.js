// Question bank. Options/answers are exactly as supplied.
// `explanation` texts are DRAFTS written by the developer - verify before the event.
// image: null or "/images/q11.webp" (file goes in client/public/images/).
const L = 'ABCD';
const q = (id, options, hint, answer, explanation, image = null) => {
  const i = answer === null ? -1 : options.indexOf(answer);
  if (answer !== null && i < 0) throw new Error('Q' + id + ': answer not in options');
  return { id, options, hint, explanation, image, letter: i < 0 ? null : L[i], needsVerify: answer === null };
};
module.exports = [
  q(1, ['Methane', 'Ethane', 'Cyclopentane', 'Propane'], 'Look at their basic structure.', 'Cyclopentane', 'Cyclopentane is a ring (cyclic) hydrocarbon; the others are straight-chain alkanes.'),
  q(2, ['Dry Gas', 'Wet Gas', 'Gas Condensate', 'Black Oil'], 'One of these belongs to a different fluid family.', 'Black Oil', 'The first three are gas-type reservoir fluids; black oil is an oil-type fluid.'),
  q(3, ['Effective Porosity', 'Primary Porosity', 'Secondary Porosity', 'Kinematic Porosity'], 'Three describe how pore space is considered.', 'Kinematic Porosity', 'Effective, primary and secondary porosity are standard terms; kinematic porosity is not.'),
  q(4, ['Mumbai High', 'Digboi', 'Mangala', 'Jharia'], 'Think about what each location is famous for underground.', 'Jharia', 'Jharia is a coalfield; the others are oil fields.'),
  q(5, ['Exploration', 'Drilling', 'Refining', 'Seismic Surveying'], 'Think about where each fits in the petroleum journey.', 'Refining', 'Refining is downstream; the others are upstream activities.'),
  q(6, ['Saudi Aramco', 'Pemex', 'ONGC', 'ExxonMobil'], 'Look beyond the company names.', 'ExxonMobil', 'The other three are state-owned national oil companies; ExxonMobil is a publicly traded major.'),
  q(7, ['Halliburton', 'Baker Hughes', 'Transocean', 'Weatherford'], "Their roles in the industry aren't identical.", 'Transocean', 'Halliburton, Baker Hughes and Weatherford are primarily oilfield service companies, while Transocean is primarily an offshore drilling contractor.'),
  q(8, ['Gasoline', 'Diesel', 'Kerosene', 'Kerogen'], 'Three can come out of a refinery.', 'Kerogen', 'Kerogen is the organic matter in source rock that generates oil; it is not a refinery product.'),
  q(9, ['Crayons', 'Bubble Gum Base', 'Lipstick', 'Graphite Pencil Lead'], 'Think about what goes into making them.', 'Graphite Pencil Lead', 'The others commonly use petroleum-derived waxes; pencil lead is graphite and clay.'),
  q(10, ['CO₂', 'H₂S', 'N₂', 'CH₄'], 'Check what each molecule represents.', 'CH₄', 'CO₂, H₂S and N₂ are non-hydrocarbon impurities in natural gas; CH₄ is a hydrocarbon.'),
  q(11, ['θ = 25°', 'θ = 50°', 'θ = 80°', 'θ = 105°'], 'The angle changes what happens at the surface.', 'θ = 105°', 'Contact angles below 90° are wetting; 105° is non-wetting.'),
  q(12, ['Relative Permeability', 'Effective Permeability', 'Capillary Pressure', 'Rock Compressibility'], 'Think about what happens when fluids move through the rock.', 'Rock Compressibility', 'The first three describe multiphase fluid behaviour in rock; rock compressibility is a rock property alone.'),
  q(13, ['Cubic Packing', 'Orthorhombic Packing', 'Hexagonal Packing', 'Rhombohedral Packing'], 'Visualize how the particles are arranged.', 'Cubic Packing', 'Cubic is the loosest arrangement (about 47.6% porosity). [VERIFY intended logic]'),
  q(14, ['Brent', 'WTI', 'Dubai Crude', 'Henry Hub'], 'Their names are used when talking about prices.', 'Henry Hub', 'Brent, WTI and Dubai are crude oil benchmarks; Henry Hub is a natural gas pricing point.'),
  q(15, ['BP', 'Shell', 'Chevron', 'Saudi Aramco'], 'Consider who stands behind each name.', 'Saudi Aramco', 'Saudi Aramco is state-controlled; the others are investor-owned international oil companies.'),
  q(16, ['Mumbai High North Fire', 'Mori-5 Blowout', 'Baghjan Blowout', 'Deepwater Horizon'], 'Look at where these incidents took place.', 'Deepwater Horizon', 'Deepwater Horizon happened in the Gulf of Mexico; the others happened in India.'),
  q(17, ['Porosity', 'Permeability', 'Wettability', 'Viscosity'], 'Three are closely tied to the rock–fluid system.', 'Viscosity', 'Viscosity is a property of the fluid itself.'),
  q(18, ['The Big Seven', 'The Seven Sisters', 'The Oil Cartel', 'The Petroleum League'], 'One name became famous in petroleum history.', 'The Seven Sisters', 'The Seven Sisters was the nickname of the seven oil majors that dominated mid-20th-century oil.'),
  q(19, ['Methane', 'Ethyl Mercaptan', 'Carbon Monoxide', 'Sulfur Dioxide'], 'Think about what you would notice during a leak.', 'Ethyl Mercaptan', 'Ethyl mercaptan is the strong-smelling odorant added to gas so leaks can be noticed.'),
  q(20, ['Light Vapor Fractions', 'Heavy Bottom Residuals', 'Kerosene Distillate', 'Purified Methane'], 'Think about the heavier end of crude.', 'Heavy Bottom Residuals', 'The others are light products or fractions; residuals are the heavy end left at the bottom.'),
  q(21, ['Blind Well', 'Wildcat Well', 'Stray Well', 'Black Well'], 'The terminology comes from exploration drilling.', 'Wildcat Well', 'A wildcat well is an exploration well drilled in an unproven area.'),
  q(22, ['Oil Tower', 'Christmas Tree', 'Crown Block', 'Manifold Gate'], 'One name sounds much less technical than the others.', 'Christmas Tree', 'A Christmas tree is the nickname for the valve assembly on top of a wellhead.'),
  q(23, ['Cotton', 'Plastics', 'Wool', 'Silk'], 'Consider their origin rather than their appearance.', 'Plastics', 'Cotton, wool and silk are natural; plastics are synthetic and mostly petroleum-derived.'),
  // Q24: NO CORRECT ANSWER WAS SUPPLIED. The host must pick it on the dashboard before reveal.
  q(24, ['Saudi Arabia', 'Venezuela', 'USA', 'Russia'], 'Compare their underground resources, not production.', null, 'Answer to be confirmed by the host.'),
];

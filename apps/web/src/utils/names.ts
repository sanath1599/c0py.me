// 200 random names for user generation
const RANDOM_NAMES = [
  'Alex', 'Sam', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Quinn', 'Avery',
  'Morgan', 'Drew', 'Blake', 'Cameron', 'Dakota', 'Emery', 'Finley', 'Harper',
  'Indigo', 'Jules', 'Kai', 'Logan', 'Mason', 'Nova', 'Ocean', 'Parker',
  'Quincy', 'River', 'Sage', 'Tatum', 'Unity', 'Vale', 'Winter', 'Xander',
  'Zara', 'Atlas', 'Briar', 'Cedar', 'Dawn', 'Echo', 'Flint', 'Grove',
  'Haven', 'Iris', 'Jade', 'Kestrel', 'Luna', 'Moss', 'Nyx', 'Orion',
  'Phoenix', 'Rain', 'Storm', 'Thunder', 'Vega', 'Willow', 'Yarrow', 'Zen',
  'Aria', 'Blaze', 'Canyon', 'Delta', 'Eden', 'Frost', 'Glade', 'Hawk',
  'Ivy', 'Jasper', 'Kite', 'Lark', 'Meadow', 'Nest', 'Onyx', 'Pine',
  'Quill', 'Raven', 'Shadow', 'Tide', 'Umber', 'Vapor', 'Wisp', 'Xero',
  'Yara', 'Zephyr', 'Ash', 'Birch', 'Clove', 'Dune', 'Elm', 'Fern',
  'Gale', 'Hazel', 'Iris', 'Juniper', 'Kale', 'Linden', 'Maple', 'Nettle',
  'Oak', 'Poppy', 'Quartz', 'Rowan', 'Sage', 'Thyme', 'Violet', 'Wren',
  'Yarrow', 'Zinnia', 'Alder', 'Basil', 'Cypress', 'Dahlia', 'Elder', 'Fennel',
  'Golden', 'Hawthorn', 'Ivy', 'Jasmine', 'Knotweed', 'Lavender', 'Mint', 'Nasturtium',
  'Oregano', 'Parsley', 'Queen', 'Rosemary', 'Saffron', 'Tarragon', 'Umbellifer', 'Verbena',
  'Wormwood', 'Xerophyte', 'Yarrow', 'Zedoary', 'Aconite', 'Belladonna', 'Celandine', 'Digitalis',
  'Echinacea', 'Foxglove', 'Ginseng', 'Henbane', 'Ipecac', 'Jaborandi', 'Kava', 'Lobelia',
  'Mandrake', 'Nux', 'Opium', 'Peyote', 'Quassia', 'Rauwolfia', 'Sassafras', 'Tansy',
  'Uva', 'Valerian', 'Witch', 'Xanthium', 'Yohimbe', 'Zedoary', 'Agaric', 'Bolete',
  'Chanterelle', 'Destroying', 'Enoki', 'Fairy', 'Giant', 'Honey', 'Inky', 'Jack',
  'King', 'Lion', 'Maitake', 'Nameko', 'Oyster', 'Portobello', 'Queen', 'Reishi',
  'Shiitake', 'Turkey', 'Umbrella', 'Velvet', 'Wood', 'Xerocomus', 'Yellow', 'Zombie',
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta',
  'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi',
  'Rho', 'Sigma', 'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega',
  'Nova', 'Pulsar', 'Quasar', 'Red', 'Supernova', 'Titan', 'Uranus', 'Venus',
  'Warp', 'Xenon', 'Yellow', 'Zenith', 'Aurora', 'Borealis', 'Comet', 'Dwarf',
  'Eclipse', 'Fusion', 'Galaxy', 'Helix', 'Infinity', 'Jupiter', 'Krypton', 'Lunar',
  'Mars', 'Nebula', 'Orbit', 'Pluto', 'Quantum', 'Rocket', 'Saturn', 'Terra',
  'Uranus', 'Void', 'Wormhole', 'Xenon', 'Yonder', 'Zero', 'Asteroid', 'Binary',
  'Cosmic', 'Dark', 'Energy', 'Flux', 'Gravity', 'Hyper', 'Ion', 'Jet',
  'Kinetic', 'Light', 'Magnetic', 'Neutron', 'Orbital', 'Plasma', 'Quantum', 'Radar',
  'Solar', 'Temporal', 'Ultra', 'Vector', 'Wave', 'Xray', 'Yield', 'Zonal'
];

// Generate a random 4-digit number
function generateRandomNumber(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Generate a random username: <name><4 random numbers>
export function generateRandomUsername(): string {
  const randomName = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
  const randomNumber = generateRandomNumber();
  return `${randomName}${randomNumber}`;
}

// Get a random name without numbers
export function getRandomName(): string {
  return RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
} 
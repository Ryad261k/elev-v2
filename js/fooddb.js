window.FoodDB = (() => {

  const FOODS = [
    // ── Viandes & volailles ─────────────────────
    { name: 'Poulet blanc (cuit)',        kcal: 165, protein: 31.0, carbs: 0.0, fat: 3.6,  fibres: 0,    sodium: 75  },
    { name: 'Poulet cuisse (cuite)',      kcal: 209, protein: 26.0, carbs: 0.0, fat: 11.0, fibres: 0,    sodium: 95  },
    { name: 'Dinde blanc (cuit)',         kcal: 135, protein: 29.0, carbs: 0.0, fat: 1.7,  fibres: 0,    sodium: 60  },
    { name: 'Bœuf haché 5%',             kcal: 137, protein: 21.0, carbs: 0.0, fat: 5.5,  fibres: 0,    sodium: 65  },
    { name: 'Bœuf haché 15%',            kcal: 215, protein: 17.0, carbs: 0.0, fat: 15.0, fibres: 0,    sodium: 70  },
    { name: 'Steak bœuf',                kcal: 176, protein: 26.0, carbs: 0.0, fat: 7.5,  fibres: 0,    sodium: 65  },
    { name: 'Filet de porc (cuit)',       kcal: 143, protein: 22.0, carbs: 0.0, fat: 5.8,  fibres: 0,    sodium: 55  },
    { name: 'Côtelette de porc',         kcal: 231, protein: 25.0, carbs: 0.0, fat: 14.0 },
    { name: 'Veau escalope',             kcal: 131, protein: 22.0, carbs: 0.0, fat: 4.5  },
    { name: 'Agneau côtelette',          kcal: 294, protein: 25.0, carbs: 0.0, fat: 21.0 },
    { name: 'Jambon blanc (cuit)',        kcal: 107, protein: 17.0, carbs: 1.5, fat: 3.5,  fibres: 0,    sodium: 1050 },
    { name: 'Lardons fumés',             kcal: 337, protein: 18.0, carbs: 0.5, fat: 29.0, fibres: 0,    sodium: 800  },
    { name: 'Saucisse de Francfort',     kcal: 290, protein: 12.0, carbs: 3.0, fat: 26.0, fibres: 0,    sodium: 750  },
    // ── Poissons & fruits de mer ─────────────────
    { name: 'Saumon (cuit)',             kcal: 208, protein: 20.0, carbs: 0.0, fat: 13.0, fibres: 0,    sodium: 63  },
    { name: 'Thon en boîte (nature)',    kcal: 116, protein: 26.0, carbs: 0.0, fat: 1.0,  fibres: 0,    sodium: 310 },
    { name: 'Cabillaud (cuit)',          kcal: 105, protein: 23.0, carbs: 0.0, fat: 0.9,  fibres: 0,    sodium: 90  },
    { name: 'Crevettes cuites',          kcal: 99,  protein: 21.0, carbs: 0.9, fat: 1.1,  fibres: 0,    sodium: 566 },
    { name: 'Sardines (boîte, huile)',   kcal: 208, protein: 25.0, carbs: 0.0, fat: 11.0, fibres: 0,    sodium: 430 },
    { name: 'Maquereau (cuit)',          kcal: 262, protein: 24.0, carbs: 0.0, fat: 18.0, fibres: 0,    sodium: 95  },
    { name: 'Dorade (cuite)',            kcal: 168, protein: 28.0, carbs: 0.0, fat: 5.9  },
    { name: 'Tilapia (cuit)',            kcal: 128, protein: 26.0, carbs: 0.0, fat: 2.7  },
    { name: 'Truite (cuite)',            kcal: 190, protein: 26.0, carbs: 0.0, fat: 9.5  },
    // ── Féculents ────────────────────────────────
    { name: 'Riz blanc (cuit)',          kcal: 130, protein: 2.7,  carbs: 28.0, fat: 0.3, fibres: 0.4, sodium: 1   },
    { name: 'Riz brun (cuit)',           kcal: 123, protein: 2.7,  carbs: 25.0, fat: 1.0, fibres: 1.8, sodium: 4   },
    { name: 'Pâtes (cuites)',            kcal: 131, protein: 5.0,  carbs: 25.0, fat: 1.1, fibres: 2.5, sodium: 2   },
    { name: 'Pain blanc',                kcal: 265, protein: 8.0,  carbs: 51.0, fat: 2.5, fibres: 2.7, sodium: 520 },
    { name: 'Pain complet',              kcal: 247, protein: 9.0,  carbs: 45.0, fat: 3.4, fibres: 7.4, sodium: 430 },
    { name: 'Flocons d\'avoine',         kcal: 379, protein: 13.0, carbs: 68.0, fat: 6.9, fibres: 10.6, sodium: 2  },
    { name: 'Pomme de terre (cuite)',    kcal: 93,  protein: 2.5,  carbs: 21.0, fat: 0.1, fibres: 2.2, sodium: 5   },
    { name: 'Patate douce (cuite)',      kcal: 103, protein: 2.3,  carbs: 24.0, fat: 0.1, fibres: 3.0, sodium: 27  },
    { name: 'Quinoa (cuit)',             kcal: 120, protein: 4.4,  carbs: 21.0, fat: 1.9, fibres: 2.8, sodium: 7   },
    { name: 'Semoule (cuite)',           kcal: 112, protein: 4.0,  carbs: 23.0, fat: 0.2, fibres: 1.8, sodium: 5   },
    { name: 'Tortilla blé',             kcal: 299, protein: 8.1,  carbs: 48.0, fat: 7.5, fibres: 3.2, sodium: 540 },
    { name: 'Bagel',                     kcal: 270, protein: 10.0, carbs: 53.0, fat: 1.6, fibres: 1.5, sodium: 510 },
    { name: 'Baguette',                  kcal: 289, protein: 9.4,  carbs: 57.0, fat: 1.5, fibres: 2.3, sodium: 560 },
    // ── Légumineuses ─────────────────────────────
    { name: 'Lentilles (cuites)',        kcal: 116, protein: 9.0,  carbs: 20.0, fat: 0.4, fibres: 8.0, sodium: 4   },
    { name: 'Pois chiches (cuits)',      kcal: 164, protein: 8.9,  carbs: 27.0, fat: 2.6, fibres: 7.6, sodium: 24  },
    { name: 'Haricots rouges (cuits)',   kcal: 127, protein: 8.7,  carbs: 22.0, fat: 0.5, fibres: 8.7, sodium: 5   },
    { name: 'Haricots blancs (cuits)',   kcal: 139, protein: 9.7,  carbs: 25.0, fat: 0.5, fibres: 6.3, sodium: 7   },
    { name: 'Edamame (cuits)',           kcal: 122, protein: 11.0, carbs: 9.9,  fat: 5.2, fibres: 4.8, sodium: 5   },
    // ── Légumes ──────────────────────────────────
    { name: 'Brocoli (cuit)',            kcal: 35,  protein: 2.4,  carbs: 7.2,  fat: 0.4, fibres: 2.6, sodium: 33  },
    { name: 'Épinards (crus)',           kcal: 23,  protein: 2.9,  carbs: 3.6,  fat: 0.4, fibres: 2.2, sodium: 79  },
    { name: 'Haricots verts (cuits)',    kcal: 35,  protein: 1.9,  carbs: 7.9,  fat: 0.1, fibres: 3.4, sodium: 2   },
    { name: 'Carottes (crues)',          kcal: 41,  protein: 0.9,  carbs: 10.0, fat: 0.2, fibres: 2.8, sodium: 69  },
    { name: 'Tomate (crue)',             kcal: 18,  protein: 0.9,  carbs: 3.9,  fat: 0.2, fibres: 1.2, sodium: 5   },
    { name: 'Courgette (cuite)',         kcal: 17,  protein: 1.1,  carbs: 3.6,  fat: 0.2, fibres: 1.1, sodium: 2   },
    { name: 'Poivron (cru)',             kcal: 31,  protein: 1.0,  carbs: 6.0,  fat: 0.3, fibres: 2.1, sodium: 3   },
    { name: 'Concombre (cru)',           kcal: 15,  protein: 0.7,  carbs: 3.6,  fat: 0.1, fibres: 0.5, sodium: 2   },
    { name: 'Salade verte',             kcal: 15,  protein: 1.4,  carbs: 2.9,  fat: 0.2, fibres: 1.3, sodium: 28  },
    { name: 'Champignons de Paris',     kcal: 22,  protein: 3.1,  carbs: 3.3,  fat: 0.3, fibres: 1.0, sodium: 5   },
    { name: 'Chou-fleur (cuit)',         kcal: 25,  protein: 1.9,  carbs: 4.9,  fat: 0.3, fibres: 2.3, sodium: 20  },
    { name: 'Asperges (cuites)',         kcal: 20,  protein: 2.2,  carbs: 3.9,  fat: 0.1, fibres: 2.1, sodium: 2   },
    { name: 'Aubergine (cuite)',         kcal: 25,  protein: 0.8,  carbs: 5.7,  fat: 0.2, fibres: 2.5, sodium: 1   },
    { name: 'Petits pois (cuits)',       kcal: 84,  protein: 5.4,  carbs: 15.0, fat: 0.4, fibres: 5.5, sodium: 3   },
    { name: 'Maïs (cuit)',              kcal: 96,  protein: 3.4,  carbs: 21.0, fat: 1.5, fibres: 2.4, sodium: 15  },
    { name: 'Céleri (cru)',             kcal: 16,  protein: 0.7,  carbs: 3.0,  fat: 0.2, fibres: 1.6, sodium: 80  },
    { name: 'Oignon (cru)',             kcal: 40,  protein: 1.1,  carbs: 9.3,  fat: 0.1, fibres: 1.7, sodium: 4   },
    { name: 'Ail',                       kcal: 149, protein: 6.4,  carbs: 33.0, fat: 0.5, fibres: 2.1, sodium: 17  },
    // ── Fruits ───────────────────────────────────
    { name: 'Pomme',                     kcal: 52,  protein: 0.3,  carbs: 14.0, fat: 0.2, fibres: 2.4, sodium: 1   },
    { name: 'Banane',                    kcal: 89,  protein: 1.1,  carbs: 23.0, fat: 0.3, fibres: 2.6, sodium: 1   },
    { name: 'Orange',                    kcal: 47,  protein: 0.9,  carbs: 12.0, fat: 0.1, fibres: 2.4, sodium: 0   },
    { name: 'Fraises',                   kcal: 32,  protein: 0.7,  carbs: 7.7,  fat: 0.3, fibres: 2.0, sodium: 1   },
    { name: 'Myrtilles',                kcal: 57,  protein: 0.7,  carbs: 14.0, fat: 0.3, fibres: 2.4, sodium: 1   },
    { name: 'Raisin',                    kcal: 69,  protein: 0.7,  carbs: 18.0, fat: 0.2, fibres: 0.9, sodium: 2   },
    { name: 'Mangue',                    kcal: 60,  protein: 0.8,  carbs: 15.0, fat: 0.4, fibres: 1.6, sodium: 1   },
    { name: 'Kiwi',                      kcal: 61,  protein: 1.1,  carbs: 15.0, fat: 0.5, fibres: 3.0, sodium: 3   },
    { name: 'Poire',                     kcal: 57,  protein: 0.4,  carbs: 15.0, fat: 0.1, fibres: 3.1, sodium: 1   },
    { name: 'Ananas',                    kcal: 50,  protein: 0.5,  carbs: 13.0, fat: 0.1, fibres: 1.4, sodium: 1   },
    { name: 'Pastèque',                  kcal: 30,  protein: 0.6,  carbs: 7.6,  fat: 0.2, fibres: 0.4, sodium: 1   },
    { name: 'Abricot',                   kcal: 48,  protein: 1.4,  carbs: 11.0, fat: 0.4, fibres: 2.0, sodium: 1   },
    { name: 'Pêche',                     kcal: 39,  protein: 0.9,  carbs: 10.0, fat: 0.3, fibres: 1.5, sodium: 0   },
    { name: 'Cerise',                    kcal: 63,  protein: 1.1,  carbs: 16.0, fat: 0.2, fibres: 2.1, sodium: 0   },
    // ── Laitages & œufs ──────────────────────────
    { name: 'Lait demi-écrémé',          kcal: 47,  protein: 3.2,  carbs: 4.7,  fat: 1.6, fibres: 0,   sodium: 47  },
    { name: 'Lait entier',               kcal: 61,  protein: 3.2,  carbs: 4.8,  fat: 3.2, fibres: 0,   sodium: 44  },
    { name: 'Yaourt nature (0%)',        kcal: 55,  protein: 5.5,  carbs: 7.6,  fat: 0.2, fibres: 0,   sodium: 55  },
    { name: 'Yaourt grec nature',        kcal: 97,  protein: 9.0,  carbs: 3.6,  fat: 5.0, fibres: 0,   sodium: 46  },
    { name: 'Fromage blanc 0%',          kcal: 49,  protein: 8.0,  carbs: 4.0,  fat: 0.2, fibres: 0,   sodium: 40  },
    { name: 'Skyr nature',               kcal: 59,  protein: 10.0, carbs: 4.0,  fat: 0.2, fibres: 0,   sodium: 50  },
    { name: 'Cottage cheese',            kcal: 98,  protein: 11.0, carbs: 3.4,  fat: 4.3, fibres: 0,   sodium: 364 },
    { name: 'Œuf entier',               kcal: 155, protein: 13.0, carbs: 1.1,  fat: 11.0, fibres: 0,  sodium: 142 },
    { name: 'Blanc d\'œuf',             kcal: 52,  protein: 11.0, carbs: 0.7,  fat: 0.2, fibres: 0,   sodium: 166 },
    { name: 'Emmental',                  kcal: 382, protein: 28.0, carbs: 0.5,  fat: 29.0, fibres: 0,  sodium: 690 },
    { name: 'Mozzarella',                kcal: 280, protein: 18.0, carbs: 3.1,  fat: 22.0, fibres: 0,  sodium: 600 },
    { name: 'Parmesan',                  kcal: 431, protein: 38.0, carbs: 3.2,  fat: 29.0, fibres: 0,  sodium: 1600},
    { name: 'Feta',                      kcal: 264, protein: 14.0, carbs: 4.0,  fat: 21.0, fibres: 0,  sodium: 1116},
    { name: 'Camembert',                 kcal: 300, protein: 20.0, carbs: 0.5,  fat: 24.0, fibres: 0,  sodium: 842 },
    // ── Protéines & suppléments ───────────────────
    { name: 'Whey protéine (poudre)',    kcal: 379, protein: 80.0, carbs: 6.0,  fat: 4.0, fibres: 0,   sodium: 150 },
    { name: 'Caséine (poudre)',          kcal: 360, protein: 78.0, carbs: 5.0,  fat: 2.0, fibres: 0,   sodium: 160 },
    // ── Matières grasses & oléagineux ────────────
    { name: 'Huile d\'olive',            kcal: 884, protein: 0.0,  carbs: 0.0,  fat: 100.0, fibres: 0, sodium: 0   },
    { name: 'Huile de coco',             kcal: 862, protein: 0.0,  carbs: 0.0,  fat: 100.0, fibres: 0, sodium: 0   },
    { name: 'Beurre',                    kcal: 717, protein: 0.9,  carbs: 0.1,  fat: 81.0, fibres: 0,  sodium: 714 },
    { name: 'Amandes',                   kcal: 579, protein: 21.0, carbs: 22.0, fat: 50.0, fibres: 12.5, sodium: 1 },
    { name: 'Noix',                      kcal: 654, protein: 15.0, carbs: 14.0, fat: 65.0, fibres: 6.7, sodium: 2  },
    { name: 'Cacahuètes',               kcal: 567, protein: 26.0, carbs: 16.0, fat: 49.0, fibres: 8.5, sodium: 18 },
    { name: 'Beurre de cacahuète',       kcal: 598, protein: 25.0, carbs: 20.0, fat: 51.0, fibres: 6.0, sodium: 59 },
    { name: 'Avocat',                    kcal: 160, protein: 2.0,  carbs: 9.0,  fat: 15.0, fibres: 6.7, sodium: 7  },
    { name: 'Noix de cajou',             kcal: 553, protein: 18.0, carbs: 30.0, fat: 44.0, fibres: 3.3, sodium: 12 },
    // ── Divers ───────────────────────────────────
    { name: 'Chocolat noir 70%',         kcal: 598, protein: 8.0,  carbs: 46.0, fat: 43.0, fibres: 10.9, sodium: 5 },
    { name: 'Miel',                      kcal: 304, protein: 0.3,  carbs: 82.0, fat: 0.0, fibres: 0.2, sodium: 4   },
    { name: 'Sauce tomate',              kcal: 29,  protein: 1.6,  carbs: 5.8,  fat: 0.2, fibres: 1.5, sodium: 280 },
    { name: 'Mayonnaise',                kcal: 680, protein: 1.0,  carbs: 0.6,  fat: 75.0, fibres: 0,  sodium: 640 },
    { name: 'Crème fraîche 30%',        kcal: 292, protein: 2.5,  carbs: 2.9,  fat: 30.0, fibres: 0,  sodium: 40  },
    { name: 'Ketchup',                   kcal: 101, protein: 1.2,  carbs: 25.0, fat: 0.1, fibres: 0.7, sodium: 700 },
    { name: 'Moutarde',                  kcal: 66,  protein: 4.4,  carbs: 6.0,  fat: 3.3, fibres: 3.0, sodium: 1120},
  ];

  function normalize(s) {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function search(query) {
    if (!query || query.length < 1) return FOODS.slice(0, 24);
    const q = normalize(query);
    const tokens = q.split(/\s+/).filter(Boolean);
    return FOODS.filter(f => {
      const n = normalize(f.name);
      return tokens.every(t => n.includes(t));
    }).slice(0, 30);
  }

  return { search };

})();

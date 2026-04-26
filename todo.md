IMPORTANTE:
Quando creo un collegamento nel capitolo e commito quel capitolo con quel collegamento se poi vado a riprendere un vecchio commit globale e poi torno a quello nuovo il commit del capitolo con il collegamento mostra il collegamento ma è come se fosse vuoto: c'è la dicitura Nessun Collegamento e il riquadro + Collega altro (non si vede il box con i collegamenti e effettivamente mi permette di collegarlo con tutte le entità)
Dobbiamo gestire i collegamenti all'interno dei commit dei capitoli e non nei commit delle versioni globali. (mi sto chiedendo se ha senso il versioning globale) Il versioning globale serve solo a salvare un istantanea del testo, dei capitoli selezionati e delle entità create o eliminate. Altrimenti quello che conta è il versioning dei singoli capitoli (dove effettivamente ci sono i collegamenti con le entità). Ah no ecco qua: se creo un entità e poi voglio committare un capitolo mi deve anche dara la possibilità di committare il tutto anche globalmente altrimenti perdo le entità quindi ricapitolando: 
collegamenti dei fragments vengono gestiti a livello di capitoli
creazione o eliminazione nuove entità vengono gestite a livello globale
todo gestiti a livello globale
GRAFO è un mondo a parte che ha sempre l'ultimo stato. Non c'è versioning dei grafi.

Devo poter collegare uno snapshot anche a un frammento di testo quindi, quando seleziono un frammento di testo nel riquadro (dove nel bubble menu c'è scritto collega, lo facciamo collegare, se si vuole anche a uno snapshot)

Devo poter dare delle icone o mettere delle immagini personalizzate (se possibile fare tutto in indexedDb) che rimangono all'interno delle card delle entità (e anche nei piccolo cerchietti delle varie entità dove sta il nome, ovviamente devono avere uno sfondo più scuro nei cerchietti)

Sarebbe carino fare una card entità che si vede sul grafo come è ora solo con spazio per l'immagine (secondo e mettere tra parentesi prima o dopo il nome l'abbreviazione)
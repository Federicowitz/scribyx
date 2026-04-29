F5 e ctrl Z non vanno mai usati. Si perdono tutti i collegamenti. Devo salvare uno stato globale ogni volta che faccio una modifica questo stato deve persistere all'F5 e al ctrl Z e deve essere salvato come pending. Se si volesse ritornare a un commit globale precedente dallo stato di pending allora l'user va avvisato

Devo poter collegare uno snapshot anche a un frammento di testo quindi, quando seleziono un frammento di testo nel riquadro (dove nel bubble menu c'è scritto collega, lo facciamo collegare, se si vuole anche a uno snapshot)

Cosa ancora più importante devo poter sovrascrivere i commit, sia dei capitoli che quelli dello stato globale. Devo avere una shortcut che mi permette di sovrascrivere il commit direttamente dall'editor. Se sovrascrivo un commit globale allora deve sovrascrivere tutti i commit attivi per i capitoli. In questo modo posso risparmiare spazio.
Devo anche poter eliminare dei commit in modo tale da liberare spazio.

Perchè la UI full screen è così brutta e meno "premium" di quella con sidebar centrata?

Altra cosa importante per i singoli capitoli. Ogni nuovo capitolo deve poter creare uno stop di pagina. Come se ci fosse un a capo ma noi non stiamo usando gli a capo per gestire il tutto quindi ogni capitolo il foglio dove scrivo deve interrompersi

Exportino pdf ;D ?!

FATTO (credo sia stato già fatto) IN REALTA' SE NON VIENE SALVATO LO STATO GLOBALE E SI RITORNA INDIETRO E' COME SE SI PERDONO TUTTI I COLLEGAMENTI NON COMMITTATI DALLO STATO GLOBALE MA SOLO DAI CAPITOLI. DA CAPIRE BENE QUESTA COSA
Quando creo un collegamento nel capitolo e commito quel capitolo con quel collegamento se poi vado a riprendere un vecchio commit globale e poi torno a quello nuovo il commit del capitolo con il collegamento mostra il collegamento ma è come se fosse vuoto: c'è la dicitura Nessun Collegamento e il riquadro + Collega altro (non si vede il box con i collegamenti e effettivamente mi permette di collegarlo con tutte le entità)
Dobbiamo gestire i collegamenti all'interno dei commit dei capitoli e non nei commit delle versioni globali. (mi sto chiedendo se ha senso il versioning globale) Il versioning globale serve solo a salvare un istantanea del testo, dei capitoli selezionati e delle entità create o eliminate. Altrimenti quello che conta è il versioning dei singoli capitoli (dove effettivamente ci sono i collegamenti con le entità). Ah no ecco qua: se creo un entità e poi voglio committare un capitolo mi deve anche dara la possibilità di committare il tutto anche globalmente altrimenti perdo le entità quindi ricapitolando:
collegamenti dei fragments vengono gestiti a livello di capitoli
creazione o eliminazione nuove entità vengono gestite a livello globale
todo gestiti a livello globale
GRAFO è un mondo a parte che ha sempre l'ultimo stato. Non c'è versioning dei grafi.

Devo poter dare delle icone o mettere delle immagini personalizzate (se possibile fare tutto in indexedDb) che rimangono all'interno delle card delle entità (e anche nei piccolo cerchietti delle varie entità dove sta il nome, ovviamente devono avere uno sfondo più scuro nei cerchietti)

Sarebbe carino fare una card entità che si vede sul grafo come è ora solo con spazio per l'immagine (secondo e mettere tra parentesi prima o dopo il nome l'abbreviazione)

// ============================================================
// SCRIPT JS DU PROJET SGBU - VERSION SIMPLE POUR ETUDIANT L1
// ============================================================


// --- Petite fonction pour afficher un message dans la page ---
function afficherMessage(texte, type) {
    var p = document.getElementById("message");
    if (p != null) {
        p.textContent = texte;
        p.className = type;
    }
}


// ============================================================
// PAGE DE CONNEXION
// ============================================================

function envoyerConnexion(evenement) {
    // On empeche le formulaire de recharger la page
    evenement.preventDefault();

    // On recupere ce que l'utilisateur a tape
    var email = document.getElementById("email").value;
    var motDePasse = document.getElementById("mot_de_passe").value;

    // Verification simple : les champs ne doivent pas etre vides
    if (email == "" || motDePasse == "") {
        afficherMessage("Veuillez remplir tous les champs.", "erreur");
        return;
    }

    // On prepare les donnees a envoyer au serveur Python
    var donnees = {
        email: email,
        mot_de_passe: motDePasse
    };

    // On envoie au serveur
    fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(donnees)
    }).then(reponseRecue).then(traiterConnexion);
}

// Etape intermediaire : transformer la reponse en objet JS
function reponseRecue(reponse) {
    return reponse.json();
}

// On regarde si la connexion a marche ou pas
function traiterConnexion(resultat) {
    if (resultat.succes == true) {
        window.location.href = "/catalogue";
    } else {
        afficherMessage(resultat.erreur, "erreur");
    }
}


// ============================================================
// PAGE D'INSCRIPTION
// ============================================================

function envoyerInscription(evenement) {
    evenement.preventDefault();

    var nom = document.getElementById("nom").value;
    var prenom = document.getElementById("prenom").value;
    var email = document.getElementById("email").value;
    var motDePasse = document.getElementById("mot_de_passe").value;

    if (nom == "" || prenom == "" || email == "" || motDePasse == "") {
        afficherMessage("Veuillez remplir tous les champs.", "erreur");
        return;
    }
    if (motDePasse.length < 6) {
        afficherMessage("Le mot de passe doit contenir au moins 6 caracteres.", "erreur");
        return;
    }

    var donnees = {
        nom: nom,
        prenom: prenom,
        email: email,
        mot_de_passe: motDePasse
    };

    fetch("/api/inscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(donnees)
    }).then(reponseRecue).then(traiterInscription);
}

function traiterInscription(resultat) {
    if (resultat.succes == true) {
        afficherMessage("Inscription reussie ! Vous pouvez vous connecter.", "message");
    } else {
        afficherMessage(resultat.erreur, "erreur");
    }
}


// ============================================================
// PAGE DU CATALOGUE
// ============================================================

function chargerNomUtilisateur(utilisateur) {
    var zone = document.getElementById("bienvenue");
    if (zone != null) {
        zone.textContent = "Bonjour " + utilisateur.prenom;
    }
    // Lien vers l'espace admin visible uniquement pour les bibliothecaires
    var lienAdmin = document.getElementById("lienAdmin");
    if (lienAdmin != null && utilisateur.role == "bibliothecaire") {
        lienAdmin.style.display = "inline";
    }
}

function afficherRessources(ressources) {
    var corps = document.getElementById("corpsTable");
    corps.innerHTML = "";

    // On parcourt chaque ressource et on cree une ligne pour chacune
    for (var i = 0; i < ressources.length; i++) {
        var r = ressources[i];

        // On choisit le bon bouton selon la disponibilite
        var boutonAction;
        if (r.disponible > 0) {
            boutonAction = '<button onclick="emprunter(' + r.id + ')">Emprunter</button>';
        } else {
            boutonAction = "Indisponible";
        }

        var ligne = document.createElement("tr");
        ligne.innerHTML =
            "<td>" + r.titre + "</td>" +
            "<td>" + r.auteur + "</td>" +
            "<td>" + r.type + "</td>" +
            "<td>" + r.categorie + "</td>" +
            "<td>" + r.disponible + "</td>" +
            "<td>" + boutonAction + "</td>";

        corps.appendChild(ligne);
    }
}

function afficherMessageCatalogue(texte, type) {
    var p = document.getElementById("messageCatalogue");
    if (p != null) {
        p.textContent = texte;
        p.className = type;
    }
}

function rechargerCatalogue() {
    fetch("/api/ressources").then(reponseRecue).then(afficherRessources);
}

function emprunter(idRessource) {
    fetch("/api/emprunter/" + idRessource, { method: "POST" })
        .then(reponseRecue)
        .then(function (resultat) {
            if (resultat.succes == true) {
                afficherMessageCatalogue("Emprunt enregistre. Retour avant le " + resultat.date_retour_prevue + ".", "message");
                rechargerCatalogue();
            } else {
                afficherMessageCatalogue(resultat.erreur, "erreur");
            }
        });
}

// Recherche : on cache les lignes qui ne contiennent pas le texte tape
function filtrerCatalogue() {
    var saisie = document.getElementById("recherche").value.toLowerCase();
    var lignes = document.querySelectorAll("#tableCatalogue tbody tr");

    for (var i = 0; i < lignes.length; i++) {
        var titre = lignes[i].cells[0].textContent.toLowerCase();
        if (titre.indexOf(saisie) > -1) {
            lignes[i].style.display = "";
        } else {
            lignes[i].style.display = "none";
        }
    }
}


// ============================================================
// AU CHARGEMENT DE LA PAGE : ON BRANCHE LES BONNES FONCTIONS
// ============================================================

// Page de connexion
if (document.getElementById("formLogin") != null) {
    document.getElementById("formLogin").onsubmit = envoyerConnexion;
}

// Page d'inscription
if (document.getElementById("formInscription") != null) {
    document.getElementById("formInscription").onsubmit = envoyerInscription;
}

// Page du catalogue
if (document.getElementById("corpsTable") != null) {
    fetch("/api/utilisateur").then(reponseRecue).then(chargerNomUtilisateur);
    fetch("/api/ressources").then(reponseRecue).then(afficherRessources);
}


// ============================================================
// PAGE "MES EMPRUNTS"
// ============================================================

function afficherMesEmprunts(donnees) {
    // Bandeau de suspension
    if (donnees.suspension_jusqu_au != null) {
        document.getElementById("messageSuspension").textContent =
            "Votre compte est suspendu jusqu'au " + donnees.suspension_jusqu_au + ".";
    }

    var corpsEmprunts = document.getElementById("corpsEmprunts");
    corpsEmprunts.innerHTML = "";

    for (var i = 0; i < donnees.emprunts.length; i++) {
        var e = donnees.emprunts[i];
        var ligne = document.createElement("tr");
        ligne.innerHTML =
            "<td>" + e.titre + "</td>" +
            "<td>" + e.type + "</td>" +
            "<td>" + e.date_emprunt + "</td>" +
            "<td>" + e.date_retour_prevue + "</td>" +
            "<td><button onclick=\"retourner(" + e.id + ")\">Retourner</button></td>";
        corpsEmprunts.appendChild(ligne);
    }
}

function retourner(idEmprunt) {
    fetch("/api/retourner/" + idEmprunt, { method: "POST" })
        .then(reponseRecue)
        .then(function (resultat) {
            if (resultat.succes == true) {
                if (resultat.sanction != "") {
                    alert(resultat.sanction);
                }
                window.location.reload();
            } else {
                alert(resultat.erreur);
            }
        });
}

if (document.getElementById("corpsEmprunts") != null) {
    fetch("/api/utilisateur").then(reponseRecue).then(chargerNomUtilisateur);
    fetch("/api/mes-emprunts").then(reponseRecue).then(afficherMesEmprunts);
}


// ============================================================
// PAGE ADMINISTRATION (BIBLIOTHECAIRE)
// ============================================================

function afficherStats(stats) {
    document.getElementById("statEtudiants").textContent = stats.nb_etudiants;
    document.getElementById("statRessources").textContent = stats.nb_ressources;
    document.getElementById("statEmprunts").textContent = stats.nb_emprunts_actifs;
    document.getElementById("statRetards").textContent = stats.nb_retards;
}

function afficherCategoriesAdmin(categories) {
    var select = document.getElementById("categorie");
    for (var i = 0; i < categories.length; i++) {
        var opt = document.createElement("option");
        opt.value = categories[i].id;
        opt.textContent = categories[i].nom;
        select.appendChild(opt);
    }
}

function afficherEmpruntsAdmin(emprunts) {
    var corps = document.getElementById("corpsEmpruntsAdmin");
    corps.innerHTML = "";
    for (var i = 0; i < emprunts.length; i++) {
        var e = emprunts[i];
        var bouton = "";
        if (e.statut == "en_cours") {
            bouton = '<button onclick="validerRetour(' + e.id + ')">Valider retour</button>';
        }
        var ligne = document.createElement("tr");
        ligne.innerHTML =
            "<td>" + e.utilisateur + "</td>" +
            "<td>" + e.titre + "</td>" +
            "<td>" + e.date_emprunt + "</td>" +
            "<td>" + e.date_retour_prevue + "</td>" +
            "<td>" + e.statut + "</td>" +
            "<td>" + bouton + "</td>";
        corps.appendChild(ligne);
    }
}

function envoyerAjoutRessource(evenement) {
    evenement.preventDefault();
    var donnees = {
        titre: document.getElementById("titre").value,
        auteur: document.getElementById("auteur").value,
        type: document.getElementById("type").value,
        quantite: parseInt(document.getElementById("quantite").value),
        categories_id: parseInt(document.getElementById("categorie").value)
    };
    fetch("/api/admin/ressources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(donnees)
    }).then(reponseRecue).then(function (resultat) {
        var msg = document.getElementById("messageAdmin");
        if (resultat.succes == true) {
            msg.textContent = "Ressource ajoutee.";
            msg.className = "message";
            chargerToutAdmin();
        } else {
            msg.textContent = resultat.erreur;
            msg.className = "erreur";
        }
    });
}

function validerRetour(idEmprunt) {
    fetch("/api/retourner/" + idEmprunt, { method: "POST" })
        .then(reponseRecue)
        .then(function (resultat) {
            if (resultat.succes == true) {
                chargerToutAdmin();
            } else {
                alert(resultat.erreur);
            }
        });
}

function chargerToutAdmin() {
    fetch("/api/admin/stats").then(reponseRecue).then(afficherStats);
    fetch("/api/admin/emprunts").then(reponseRecue).then(afficherEmpruntsAdmin);
}

if (document.getElementById("formAjoutRessource") != null) {
    fetch("/api/utilisateur").then(reponseRecue).then(chargerNomUtilisateur);
    fetch("/api/admin/categories").then(reponseRecue).then(afficherCategoriesAdmin);
    chargerToutAdmin();
    document.getElementById("formAjoutRessource").onsubmit = envoyerAjoutRessource;
}

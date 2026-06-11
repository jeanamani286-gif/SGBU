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
    document.getElementById("bienvenue").textContent = "Bonjour " + utilisateur.prenom;
}

function afficherRessources(ressources) {
    var corps = document.getElementById("corpsTable");

    // On parcourt chaque ressource et on cree une ligne pour chacune
    for (var i = 0; i < ressources.length; i++) {
        var r = ressources[i];

        // On choisit le bon bouton selon la disponibilite
        var lienAction;
        if (r.disponible > 0) {
            lienAction = '<a href="/emprunter/' + r.id + '">Emprunter</a>';
        } else {
            lienAction = '<a href="/reserver/' + r.id + '">Reserver</a>';
        }

        // On construit le HTML de la nouvelle ligne
        var ligne = document.createElement("tr");
        ligne.innerHTML =
            "<td>" + r.titre + "</td>" +
            "<td>" + r.auteur + "</td>" +
            "<td>" + r.type + "</td>" +
            "<td>" + r.categorie + "</td>" +
            "<td>" + r.disponible + "</td>" +
            "<td>" + lienAction + "</td>";

        corps.appendChild(ligne);
    }
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

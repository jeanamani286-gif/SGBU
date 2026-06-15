// Script JS du projet SGBU

// Petits raccourcis utilises partout dans le fichier
function $(id) { return document.getElementById(id); }

function getJSON(url, suite) {
    fetch(url).then(function (r) { return r.json(); }).then(suite);
}

function postJSON(url, donnees, suite) {
    fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: donnees ? JSON.stringify(donnees) : null
    }).then(function (r) { return r.json(); }).then(suite);
}

function afficherMessage(idZone, texte, type) {
    var p = $(idZone);
    if (p != null) { p.textContent = texte; p.className = type; }
}

function chargerNomUtilisateur(u) {
    var z = $("bienvenue");
    if (z != null) z.textContent = "Bonjour " + u.prenom;
    var a = $("lienAdmin");
    if (a != null && u.role == "bibliothecaire") a.style.display = "inline";
}


// ----- Connexion -----
function envoyerConnexion(ev) {
    ev.preventDefault();
    var email = $("email").value;
    var mdp = $("mot_de_passe").value;
    if (email == "" || mdp == "") {
        afficherMessage("message", "Veuillez remplir tous les champs.", "erreur");
        return;
    }
    postJSON("/api/login", { email: email, mot_de_passe: mdp }, function (res) {
        if (res.succes) window.location.href = "/catalogue";
        else afficherMessage("message", res.erreur, "erreur");
    });
}


// ----- Inscription -----
function envoyerInscription(ev) {
    ev.preventDefault();
    var donnees = {
        nom: $("nom").value,
        prenom: $("prenom").value,
        email: $("email").value,
        mot_de_passe: $("mot_de_passe").value
    };
    if (donnees.nom == "" || donnees.prenom == "" || donnees.email == "" || donnees.mot_de_passe == "") {
        afficherMessage("message", "Veuillez remplir tous les champs.", "erreur");
        return;
    }
    if (donnees.mot_de_passe.length < 6) {
        afficherMessage("message", "Le mot de passe doit contenir au moins 6 caracteres.", "erreur");
        return;
    }
    postJSON("/api/inscription", donnees, function (res) {
        if (res.succes) afficherMessage("message", "Inscription reussie ! Vous pouvez vous connecter.", "message");
        else afficherMessage("message", res.erreur, "erreur");
    });
}


// ----- Catalogue -----
function afficherRessources(ressources) {
    var corps = $("corpsTable");
    corps.innerHTML = "";
    for (var i = 0; i < ressources.length; i++) {
        var r = ressources[i];
        var action = r.disponible > 0
            ? '<button onclick="emprunter(' + r.id + ')">Emprunter</button>'
            : "Indisponible";
        var l = document.createElement("tr");
        l.innerHTML = "<td>" + r.titre + "</td><td>" + r.auteur + "</td><td>" + r.type +
                      "</td><td>" + r.categorie + "</td><td>" + r.disponible + "</td><td>" + action + "</td>";
        corps.appendChild(l);
    }
}

function emprunter(id) {
    postJSON("/api/emprunter/" + id, null, function (res) {
        if (res.succes) {
            afficherMessage("messageCatalogue", "Emprunt enregistre. Retour avant le " + res.date_retour_prevue + ".", "message");
            getJSON("/api/ressources", afficherRessources);
        } else {
            afficherMessage("messageCatalogue", res.erreur, "erreur");
        }
    });
}

function filtrerCatalogue() {
    var saisie = $("recherche").value.toLowerCase();
    var lignes = document.querySelectorAll("#tableCatalogue tbody tr");
    for (var i = 0; i < lignes.length; i++) {
        var titre = lignes[i].cells[0].textContent.toLowerCase();
        lignes[i].style.display = titre.indexOf(saisie) > -1 ? "" : "none";
    }
}


// ----- Mes emprunts -----
function afficherMesEmprunts(donnees) {
    if (donnees.suspension_jusqu_au != null) {
        $("messageSuspension").textContent =
            "Votre compte est suspendu jusqu'au " + donnees.suspension_jusqu_au + ".";
    }
    var corps = $("corpsEmprunts");
    corps.innerHTML = "";
    for (var i = 0; i < donnees.emprunts.length; i++) {
        var e = donnees.emprunts[i];
        var l = document.createElement("tr");
        l.innerHTML = "<td>" + e.titre + "</td><td>" + e.type + "</td><td>" + e.date_emprunt +
                      "</td><td>" + e.date_retour_prevue +
                      "</td><td><button onclick=\"retourner(" + e.id + ")\">Retourner</button></td>";
        corps.appendChild(l);
    }
}

function retourner(id) {
    postJSON("/api/retourner/" + id, null, function (res) {
        if (res.succes) {
            if (res.sanction != "") alert(res.sanction);
            window.location.reload();
        } else {
            alert(res.erreur);
        }
    });
}


// ----- Admin (bibliothecaire) -----
function afficherStats(s) {
    $("statEtudiants").textContent = s.nb_etudiants;
    $("statRessources").textContent = s.nb_ressources;
    $("statEmprunts").textContent = s.nb_emprunts_actifs;
    $("statRetards").textContent = s.nb_retards;
}

function afficherCategoriesAdmin(cats) {
    var sel = $("categorie");
    for (var i = 0; i < cats.length; i++) {
        var o = document.createElement("option");
        o.value = cats[i].id;
        o.textContent = cats[i].nom;
        sel.appendChild(o);
    }
}

function afficherEmpruntsAdmin(emprunts) {
    var corps = $("corpsEmpruntsAdmin");
    corps.innerHTML = "";
    for (var i = 0; i < emprunts.length; i++) {
        var e = emprunts[i];
        var bouton = e.statut == "en_cours"
            ? '<button onclick="validerRetour(' + e.id + ')">Valider retour</button>'
            : "";
        var l = document.createElement("tr");
        l.innerHTML = "<td>" + e.utilisateur + "</td><td>" + e.titre + "</td><td>" + e.date_emprunt +
                      "</td><td>" + e.date_retour_prevue + "</td><td>" + e.statut + "</td><td>" + bouton + "</td>";
        corps.appendChild(l);
    }
}

function chargerToutAdmin() {
    getJSON("/api/admin/stats", afficherStats);
    getJSON("/api/admin/emprunts", afficherEmpruntsAdmin);
}

function envoyerAjoutRessource(ev) {
    ev.preventDefault();
    var donnees = {
        titre: $("titre").value,
        auteur: $("auteur").value,
        type: $("type").value,
        quantite: parseInt($("quantite").value),
        categories_id: parseInt($("categorie").value)
    };
    postJSON("/api/admin/ressources", donnees, function (res) {
        afficherMessage("messageAdmin", res.succes ? "Ressource ajoutee." : res.erreur, res.succes ? "message" : "erreur");
        if (res.succes) chargerToutAdmin();
    });
}

function validerRetour(id) {
    postJSON("/api/retourner/" + id, null, function (res) {
        if (res.succes) chargerToutAdmin();
        else alert(res.erreur);
    });
}


// ----- Initialisation : on branche les fonctions selon la page ouverte -----
if ($("formLogin") != null) $("formLogin").onsubmit = envoyerConnexion;
if ($("formInscription") != null) $("formInscription").onsubmit = envoyerInscription;

if ($("corpsTable") != null) {
    getJSON("/api/utilisateur", chargerNomUtilisateur);
    getJSON("/api/ressources", afficherRessources);
}

if ($("corpsEmprunts") != null) {
    getJSON("/api/utilisateur", chargerNomUtilisateur);
    getJSON("/api/mes-emprunts", afficherMesEmprunts);
}

if ($("formAjoutRessource") != null) {
    getJSON("/api/utilisateur", chargerNomUtilisateur);
    getJSON("/api/admin/categories", afficherCategoriesAdmin);
    chargerToutAdmin();
    $("formAjoutRessource").onsubmit = envoyerAjoutRessource;
}


function afficherMessage(texte, type) {
    var p = document.getElementById("message");
    if (p != null) {
        p.textContent = texte;
        p.className = type;
    }
}



function envoyerConnexion(evenement) {
    evenement.preventDefault();

    var email = document.getElementById("email").value.trim();
    var motDePasse = document.getElementById("mot_de_passe").value;
    var btn = document.querySelector("#formLogin button[type='submit']");

    if (email === "" || motDePasse === "") {
        afficherMessage("Veuillez remplir tous les champs.", "erreur");
        return;
    }

    btn.disabled = true;
    btn.textContent = "Connexion...";

    fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, mot_de_passe: motDePasse })
    })
    .then(function(reponse) { return reponse.json(); })
    .then(function(resultat) {
        if (resultat.succes === true) {
            window.location.href = "/catalogue";
        } else {
            afficherMessage(resultat.erreur || "Email ou mot de passe incorrect.", "erreur");
            btn.disabled = false;
            btn.textContent = "Se connecter";
        }
    })
    .catch(function() {
        afficherMessage("Impossible de contacter le serveur. Verifiez que Flask est lance.", "erreur");
        btn.disabled = false;
        btn.textContent = "Se connecter";
    });
}



function envoyerInscription(evenement) {
    evenement.preventDefault();

    var nom = document.getElementById("nom").value.trim();
    var prenom = document.getElementById("prenom").value.trim();
    var email = document.getElementById("email").value.trim();
    var motDePasse = document.getElementById("mot_de_passe").value;
    var btn = document.querySelector("#formInscription button[type='submit']");

    if (nom === "" || prenom === "" || email === "" || motDePasse === "") {
        afficherMessage("Veuillez remplir tous les champs.", "erreur");
        return;
    }
    if (motDePasse.length < 6) {
        afficherMessage("Le mot de passe doit contenir au moins 6 caracteres.", "erreur");
        return;
    }

    btn.disabled = true;
    btn.textContent = "Inscription...";

    fetch("/api/inscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: nom, prenom: prenom, email: email, mot_de_passe: motDePasse })
    })
    .then(function(reponse) { return reponse.json(); })
    .then(function(resultat) {
        if (resultat.succes === true) {
            afficherMessage("Inscription reussie ! Vous pouvez vous connecter.", "message");
            setTimeout(function() { window.location.href = "/"; }, 1500);
        } else {
            afficherMessage(resultat.erreur || "Une erreur est survenue.", "erreur");
            btn.disabled = false;
            btn.textContent = "Creer mon compte";
        }
    })
    .catch(function() {
        afficherMessage("Impossible de contacter le serveur. Verifiez que Flask est lance.", "erreur");
        btn.disabled = false;
        btn.textContent = "Creer mon compte";
    });
}



function chargerNomUtilisateur(utilisateur) {
    var el = document.getElementById("bienvenue");
    if (el) el.textContent = "Bonjour " + utilisateur.prenom;
}

function afficherRessources(ressources) {
    var corps = document.getElementById("corpsTable");
    if (!corps) return;
    corps.innerHTML = "";

    if (ressources.length === 0) {
        var ligne = document.createElement("tr");
        ligne.innerHTML = "<td colspan='6'>Aucune ressource disponible.</td>";
        corps.appendChild(ligne);
        return;
    }

    for (var i = 0; i < ressources.length; i++) {
        var r = ressources[i];
        var lienAction;
        if (r.disponible > 0) {
            lienAction = '<button onclick="emprunter(' + r.id + ', this)">Emprunter</button>';
        } else {
            lienAction = '<span style="color:#999;">Indisponible</span>';
        }
        var ligne = document.createElement("tr");
        ligne.innerHTML =
            "<td>" + (r.titre || "") + "</td>" +
            "<td>" + (r.auteur || "") + "</td>" +
            "<td>" + (r.type || "") + "</td>" +
            "<td>" + (r.categorie || "") + "</td>" +
            "<td>" + r.disponible + "</td>" +
            "<td>" + lienAction + "</td>";
        corps.appendChild(ligne);
    }
}

function emprunter(ressourceId, btn) {
    btn.disabled = true;
    btn.textContent = "...";
    fetch("/api/emprunter/" + ressourceId, { method: "POST" })
    .then(function(r) { return r.json(); })
    .then(function(res) {
        if (res.succes) {
            alert("Emprunt effectue ! A rendre le : " + res.date_retour_prevue);
            window.location.reload();
        } else {
            alert(res.erreur || "Erreur lors de l'emprunt.");
            btn.disabled = false;
            btn.textContent = "Emprunter";
        }
    })
    .catch(function() {
        alert("Erreur reseau.");
        btn.disabled = false;
        btn.textContent = "Emprunter";
    });
}

function filtrerCatalogue() {
    var saisie = document.getElementById("recherche").value.toLowerCase();
    var lignes = document.querySelectorAll("#tableCatalogue tbody tr");
    for (var i = 0; i < lignes.length; i++) {
        var titre = lignes[i].cells[0] ? lignes[i].cells[0].textContent.toLowerCase() : "";
        lignes[i].style.display = titre.indexOf(saisie) > -1 ? "" : "none";
    }
}



function afficherMesEmprunts(data) {
    var suspension = document.getElementById("suspension");
    if (suspension && data.suspension_jusqu_au) {
        suspension.textContent = "Compte suspendu jusqu'au " + data.suspension_jusqu_au;
        suspension.style.display = "block";
    }

    var corps = document.getElementById("corpsEmprunts");
    if (!corps) return;
    corps.innerHTML = "";

    if (!data.emprunts || data.emprunts.length === 0) {
        var ligne = document.createElement("tr");
        ligne.innerHTML = "<td colspan='5'>Aucun emprunt en cours.</td>";
        corps.appendChild(ligne);
        return;
    }

    for (var i = 0; i < data.emprunts.length; i++) {
        var e = data.emprunts[i];
        var ligne = document.createElement("tr");
        ligne.innerHTML =
            "<td>" + (e.titre || "") + "</td>" +
            "<td>" + (e.auteur || "") + "</td>" +
            "<td>" + (e.date_emprunt || "") + "</td>" +
            "<td>" + (e.date_retour_prevue || "") + "</td>" +
            "<td><button onclick=\"retourner(" + e.id + ", this)\">Retourner</button></td>";
        corps.appendChild(ligne);
    }
}

function retourner(empruntId, btn) {
    btn.disabled = true;
    btn.textContent = "...";
    fetch("/api/retourner/" + empruntId, { method: "POST" })
    .then(function(r) { return r.json(); })
    .then(function(res) {
        if (res.succes) {
            if (res.sanction) alert(res.sanction);
            window.location.reload();
        } else {
            alert(res.erreur || "Erreur.");
            btn.disabled = false;
            btn.textContent = "Retourner";
        }
    })
    .catch(function() {
        alert("Erreur reseau.");
        btn.disabled = false;
        btn.textContent = "Retourner";
    });
}


if (document.getElementById("formLogin") !== null) {
    document.getElementById("formLogin").onsubmit = envoyerConnexion;
}

if (document.getElementById("formInscription") !== null) {
    document.getElementById("formInscription").onsubmit = envoyerInscription;
}

if (document.getElementById("corpsTable") !== null) {
    fetch("/api/utilisateur")
        .then(function(r) { return r.json(); })
        .then(chargerNomUtilisateur)
        .catch(function() { window.location.href = "/"; });

    fetch("/api/ressources")
        .then(function(r) { return r.json(); })
        .then(afficherRessources)
        .catch(function() { afficherMessage("Erreur de chargement du catalogue.", "erreur"); });
}

if (document.getElementById("corpsEmprunts") !== null) {
    fetch("/api/mes-emprunts")
        .then(function(r) { return r.json(); })
        .then(afficherMesEmprunts)
        .catch(function() { afficherMessage("Erreur de chargement.", "erreur"); });
}

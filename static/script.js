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
            if (resultat.role === "bibliothecaire") {
                window.location.href = "/admin";
            } else {
                window.location.href = "/catalogue";
            }
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
    // Afficher le lien "Tableau de bord" si bibliothecaire
    var lienAdmin = document.getElementById("lienAdmin");
    if (lienAdmin && utilisateur.role === "bibliothecaire") {
        lienAdmin.style.display = "inline";
    }
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
        } else if (r.ma_reservation === "disponible") {
            lienAction = '<span class="badge badge-ok">Disponible pour vous (48h)</span>';
        } else if (r.ma_reservation === "en_attente") {
            lienAction = '<span class="badge badge-non">Reservee (en attente)</span>';
        } else {
            lienAction = '<button onclick="reserver(' + r.id + ', this)">Reserver</button>';
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

function reserver(ressourceId, btn) {
    btn.disabled = true;
    btn.textContent = "...";
    fetch("/api/reserver/" + ressourceId, { method: "POST" })
    .then(function(r) { return r.json(); })
    .then(function(res) {
        if (res.succes) {
            alert("Reservation enregistree ! Vous serez notifie des qu'une copie sera disponible (48h pour venir la chercher).");
            window.location.reload();
        } else {
            alert(res.erreur || "Erreur lors de la reservation.");
            btn.disabled = false;
            btn.textContent = "Reserver";
        }
    })
    .catch(function() {
        alert("Erreur reseau.");
        btn.disabled = false;
        btn.textContent = "Reserver";
    });
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


// ------------------------------------------------------------------
// Reservations (page "mes emprunts")
// ------------------------------------------------------------------

function afficherMesReservations(reservations) {
    var corps = document.getElementById("corpsReservations");
    if (!corps) return;
    corps.innerHTML = "";

    if (!reservations || reservations.length === 0) {
        var ligne = document.createElement("tr");
        ligne.innerHTML = "<td colspan='5'>Aucune reservation en cours.</td>";
        corps.appendChild(ligne);
        return;
    }

    for (var i = 0; i < reservations.length; i++) {
        var r = reservations[i];
        var statutAffiche, action;
        if (r.statut === "disponible") {
            statutAffiche = '<span class="badge badge-ok">A recuperer avant le ' + r.date_expiration + '</span>';
            action = '<button onclick="recupererReservation(' + r.id + ', this)">Recuperer</button> ' +
                     '<button onclick="annulerReservation(' + r.id + ', this)">Annuler</button>';
        } else {
            statutAffiche = '<span class="badge badge-non">En attente</span>';
            action = '<button onclick="annulerReservation(' + r.id + ', this)">Annuler</button>';
        }
        var ligne = document.createElement("tr");
        ligne.innerHTML =
            "<td>" + (r.titre || "") + "</td>" +
            "<td>" + (r.type || "") + "</td>" +
            "<td>" + (r.date_reservation || "") + "</td>" +
            "<td>" + statutAffiche + "</td>" +
            "<td>" + action + "</td>";
        corps.appendChild(ligne);
    }
}

function recupererReservation(reservationId, btn) {
    btn.disabled = true;
    btn.textContent = "...";
    fetch("/api/recuperer-reservation/" + reservationId, { method: "POST" })
    .then(function(r) { return r.json(); })
    .then(function(res) {
        if (res.succes) {
            alert("Ressource recuperee ! A rendre le : " + res.date_retour_prevue);
            window.location.reload();
        } else {
            alert(res.erreur || "Erreur lors de la recuperation.");
            btn.disabled = false;
            btn.textContent = "Recuperer";
        }
    })
    .catch(function() { alert("Erreur reseau."); window.location.reload(); });
}

function annulerReservation(reservationId, btn) {
    btn.disabled = true;
    fetch("/api/annuler-reservation/" + reservationId, { method: "POST" })
    .then(function(r) { return r.json(); })
    .then(function(res) {
        if (res.succes) {
            window.location.reload();
        } else {
            alert(res.erreur || "Erreur lors de l'annulation.");
            btn.disabled = false;
        }
    })
    .catch(function() { alert("Erreur reseau."); window.location.reload(); });
}


// ------------------------------------------------------------------
// Notifications (cloche + panneau deroulant, presents sur chaque page)
// ------------------------------------------------------------------

function chargerNotifications() {
    var cloche = document.getElementById("clocheNotif");
    if (!cloche) return;

    fetch("/api/notifications")
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var badge = document.getElementById("badgeNotif");
            if (badge) {
                if (data.non_lues > 0) {
                    badge.textContent = data.non_lues;
                    badge.style.display = "inline-block";
                } else {
                    badge.style.display = "none";
                }
            }

            var liste = document.getElementById("listeNotifications");
            if (!liste) return;
            liste.innerHTML = "";

            if (!data.notifications || data.notifications.length === 0) {
                liste.innerHTML = "<li class='notif-vide'>Aucune notification.</li>";
                return;
            }

            for (var i = 0; i < data.notifications.length; i++) {
                var n = data.notifications[i];
                var classe = "notif-item";
                if (n.lu === false) {
                    classe = "notif-item notif-non-lue";
                }
                var item = document.createElement("li");
                item.className = classe;
                item.innerHTML =
                    "<span class='notif-message'>" + n.message + "</span>" +
                    "<span class='notif-date'>" + n.date_creation + "</span>";
                if (n.lu === false) {
                    item.setAttribute("onclick", "marquerNotificationLue(" + n.id + ")");
                }
                liste.appendChild(item);
            }
        })
        .catch(function() {});
}

function marquerNotificationLue(notifId) {
    fetch("/api/notifications/lire/" + notifId, { method: "POST" })
        .then(function() { 
// Page admin
if (document.getElementById("corpsEmpruntsAdmin") !== null) {
    fetch("/api/utilisateur")
        .then(function(r) { return r.json(); })
        .then(chargerNomUtilisateur)
        .catch(function() {});

    fetch("/api/admin/stats")
        .then(function(r) { return r.json(); })
        .then(chargerStats)
        .catch(function() {});

    fetch("/api/admin/emprunts")
        .then(function(r) { return r.json(); })
        .then(afficherEmpruntsAdmin)
        .catch(function() {});

    chargerCategoriesAdmin();

    var formAdmin = document.getElementById("formAjoutRessource");
    if (formAdmin) formAdmin.onsubmit = soumettreAjoutRessource;
}

chargerNotifications(); });
}

function toutMarquerLu() {
    fetch("/api/notifications/tout-lire", { method: "POST" })
        .then(function() { 
// Page admin
if (document.getElementById("corpsEmpruntsAdmin") !== null) {
    fetch("/api/utilisateur")
        .then(function(r) { return r.json(); })
        .then(chargerNomUtilisateur)
        .catch(function() {});

    fetch("/api/admin/stats")
        .then(function(r) { return r.json(); })
        .then(chargerStats)
        .catch(function() {});

    fetch("/api/admin/emprunts")
        .then(function(r) { return r.json(); })
        .then(afficherEmpruntsAdmin)
        .catch(function() {});

    chargerCategoriesAdmin();

    var formAdmin = document.getElementById("formAjoutRessource");
    if (formAdmin) formAdmin.onsubmit = soumettreAjoutRessource;
}

chargerNotifications(); });
}

function basculerPanneauNotifications() {
    var panneau = document.getElementById("panneauNotifications");
    if (panneau) panneau.classList.toggle("ouvert");
}

document.addEventListener("click", function(evenement) {
    var panneau = document.getElementById("panneauNotifications");
    var cloche = document.getElementById("clocheNotif");
    if (!panneau || !cloche) return;
    if (!panneau.contains(evenement.target) && !cloche.contains(evenement.target)) {
        panneau.classList.remove("ouvert");
    }
});



// ==============================================================
// PAGE ADMIN (ESPACE BIBLIOTHECAIRE)
// ==============================================================

function chargerStats(stats) {
    var el;
    el = document.getElementById("statEtudiants");   if (el) el.textContent = stats.nb_etudiants;
    el = document.getElementById("statRessources");  if (el) el.textContent = stats.nb_ressources;
    el = document.getElementById("statEmprunts");    if (el) el.textContent = stats.nb_emprunts_actifs;
    el = document.getElementById("statRetards");     if (el) el.textContent = stats.nb_retards;
    el = document.getElementById("statReservations"); if (el) el.textContent = stats.nb_reservations || 0;
}

function chargerCategoriesAdmin() {
    var sel = document.getElementById("categorie");
    if (!sel) return;
    fetch("/api/admin/categories")
        .then(function(r) { return r.json(); })
        .then(function(cats) {
            sel.innerHTML = "";
            cats.forEach(function(c) {
                var opt = document.createElement("option");
                opt.value = c.id;
                opt.textContent = c.nom;
                sel.appendChild(opt);
            });
        })
        .catch(function() {});
}

function afficherEmpruntsAdmin(emprunts) {
    var corps = document.getElementById("corpsEmpruntsAdmin");
    if (!corps) return;
    corps.innerHTML = "";

    if (!emprunts || emprunts.length === 0) {
        var ligne = document.createElement("tr");
        ligne.innerHTML = "<td colspan='6' style='text-align:center;color:#7c89ad;'>Aucun emprunt enregistre.</td>";
        corps.appendChild(ligne);
        return;
    }

    var maintenant = new Date();
    for (var i = 0; i < emprunts.length; i++) {
        var e = emprunts[i];
        var enRetard = e.statut === "en_cours" && new Date(e.date_retour_prevue_raw) < maintenant;
        var badge = e.statut === "retourne"
            ? '<span class="badge badge-ok">Retourne</span>'
            : (enRetard
                ? '<span class="badge badge-retard">En retard</span>'
                : '<span class="badge badge-ok">En cours</span>');

        var action = e.statut === "en_cours"
            ? '<button onclick="retournerAdmin(' + e.id + ', this)">Retourner</button>'
            : "-";

        var ligne = document.createElement("tr");
        ligne.innerHTML =
            "<td>" + (e.utilisateur || "") + "</td>" +
            "<td>" + (e.titre || "") + "</td>" +
            "<td>" + (e.date_emprunt || "") + "</td>" +
            "<td>" + (e.date_retour_prevue || "") + "</td>" +
            "<td>" + badge + "</td>" +
            "<td>" + action + "</td>";
        corps.appendChild(ligne);
    }
}

function retournerAdmin(empruntId, btn) {
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
    .catch(function() { alert("Erreur reseau."); btn.disabled = false; btn.textContent = "Retourner"; });
}

function soumettreAjoutRessource(evenement) {
    evenement.preventDefault();
    var btn = document.querySelector("#formAjoutRessource button[type='submit']");
    btn.disabled = true;
    btn.textContent = "Ajout...";

    var donnees = {
        titre:        document.getElementById("titre").value.trim(),
        auteur:       document.getElementById("auteur").value.trim(),
        type:         document.getElementById("type").value,
        quantite:     parseInt(document.getElementById("quantite").value),
        categories_id: parseInt(document.getElementById("categorie").value)
    };

    fetch("/api/admin/ressources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(donnees)
    })
    .then(function(r) { return r.json(); })
    .then(function(res) {
        var msg = document.getElementById("messageAdmin");
        if (res.succes) {
            if (msg) { msg.textContent = "Ressource ajoutee avec succes !"; msg.style.color = "#6fcf97"; }
            document.getElementById("formAjoutRessource").reset();
            chargerCategoriesAdmin();
            btn.disabled = false;
            btn.textContent = "Ajouter";
        } else {
            if (msg) { msg.textContent = res.erreur || "Erreur."; msg.style.color = "#e57373"; }
            btn.disabled = false;
            btn.textContent = "Ajouter";
        }
    })
    .catch(function() {
        var msg = document.getElementById("messageAdmin");
        if (msg) { msg.textContent = "Erreur reseau."; msg.style.color = "#e57373"; }
        btn.disabled = false;
        btn.textContent = "Ajouter";
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

    fetch("/api/mes-reservations")
        .then(function(r) { return r.json(); })
        .then(afficherMesReservations)
        .catch(function() {});
}


// Page admin
if (document.getElementById("corpsEmpruntsAdmin") !== null) {
    fetch("/api/utilisateur")
        .then(function(r) { return r.json(); })
        .then(chargerNomUtilisateur)
        .catch(function() {});

    fetch("/api/admin/stats")
        .then(function(r) { return r.json(); })
        .then(chargerStats)
        .catch(function() {});

    fetch("/api/admin/emprunts")
        .then(function(r) { return r.json(); })
        .then(afficherEmpruntsAdmin)
        .catch(function() {});

    chargerCategoriesAdmin();

    var formAdmin = document.getElementById("formAjoutRessource");
    if (formAdmin) formAdmin.onsubmit = soumettreAjoutRessource;
}

chargerNotifications();
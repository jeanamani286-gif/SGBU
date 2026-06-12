# Routes pour l'etudiant : connexion, inscription, catalogue,
# emprunter, retourner, mes emprunts.

import datetime
import flask
import werkzeug.security

import database

# Un "Blueprint" est juste un groupe de routes
# qu'on attache ensuite a l'application principale.
bp = flask.Blueprint("etudiant", __name__)


# --- Pages HTML ---

@bp.route("/")
def page_accueil():
    return flask.render_template("login.html")


@bp.route("/inscription")
def page_inscription():
    return flask.render_template("inscription.html")


@bp.route("/catalogue")
def page_catalogue():
    if "user_id" not in flask.session:
        return flask.redirect("/")
    return flask.render_template("catalogue.html")


@bp.route("/mes-emprunts")
def page_mes_emprunts():
    if "user_id" not in flask.session:
        return flask.redirect("/")
    return flask.render_template("mes_emprunts.html")


@bp.route("/logout")
def logout():
    flask.session.clear()
    return flask.redirect("/")


# --- Authentification ---

@bp.route("/api/login", methods=["POST"])
def api_login():
    donnees = flask.request.get_json()
    db = database.get_db()
    curseur = db.cursor()
    curseur.execute("SELECT * FROM users WHERE email = %s", (donnees["email"],))
    utilisateur = curseur.fetchone()
    db.close()

    if utilisateur and werkzeug.security.check_password_hash(utilisateur["mot_de_passe"], donnees["mot_de_passe"]):
        flask.session["user_id"] = utilisateur["id"]
        flask.session["nom"] = utilisateur["nom"]
        flask.session["prenom"] = utilisateur["prenom"]
        flask.session["role"] = utilisateur["role"]
        return flask.jsonify({"succes": True})
    return flask.jsonify({"succes": False, "erreur": "Email ou mot de passe incorrect."})


@bp.route("/api/inscription", methods=["POST"])
def api_inscription():
    donnees = flask.request.get_json()
    db = database.get_db()
    curseur = db.cursor()

    curseur.execute("SELECT id FROM users WHERE email = %s", (donnees["email"],))
    if curseur.fetchone():
        db.close()
        return flask.jsonify({"succes": False, "erreur": "Cet email est deja utilise."})

    mdp_chiffre = werkzeug.security.generate_password_hash(donnees["mot_de_passe"])
    curseur.execute(
        "INSERT INTO users (nom, prenom, email, mot_de_passe, role) VALUES (%s, %s, %s, %s, 'etudiant')",
        (donnees["nom"], donnees["prenom"], donnees["email"], mdp_chiffre)
    )
    db.commit()
    db.close()
    return flask.jsonify({"succes": True})


@bp.route("/api/utilisateur")
def api_utilisateur():
    if "user_id" not in flask.session:
        return flask.jsonify({"erreur": "Non connecte"}), 401
    return flask.jsonify({
        "nom": flask.session["nom"],
        "prenom": flask.session["prenom"],
        "role": flask.session["role"]
    })


# --- Catalogue ---

@bp.route("/api/ressources")
def api_ressources():
    if "user_id" not in flask.session:
        return flask.jsonify({"erreur": "Non connecte"}), 401
    db = database.get_db()
    curseur = db.cursor()
    curseur.execute("""
        SELECT r.id, r.titre, r.auteur, r.type, r.disponible, c.nom AS categorie
        FROM ressources r
        LEFT JOIN categories c ON r.categories_id = c.id
        ORDER BY r.titre
    """)
    ressources = curseur.fetchall()
    db.close()
    return flask.jsonify(ressources)


# --- Emprunter / Retourner / Reserver ---

@bp.route("/api/emprunter/<int:ressource_id>", methods=["POST"])
def api_emprunter(ressource_id):
    if "user_id" not in flask.session:
        return flask.jsonify({"succes": False, "erreur": "Non connecte"}), 401

    user_id = flask.session["user_id"]
    db = database.get_db()
    curseur = db.cursor()

    if database.utilisateur_suspendu(curseur, user_id):
        db.close()
        return flask.jsonify({"succes": False, "erreur": "Votre compte est suspendu suite a un retard."})

    if database.compter_emprunts_actifs(curseur, user_id) >= database.MAX_EMPRUNTS_SIMULTANES:
        db.close()
        return flask.jsonify({"succes": False, "erreur": "Vous avez atteint la limite de 5 emprunts."})

    curseur.execute("SELECT * FROM ressources WHERE id = %s", (ressource_id,))
    ressource = curseur.fetchone()
    if not ressource:
        db.close()
        return flask.jsonify({"succes": False, "erreur": "Ressource introuvable."})
    if ressource["disponible"] <= 0:
        db.close()
        return flask.jsonify({"succes": False, "erreur": "Ressource non disponible. Vous pouvez la reserver."})

    date_emprunt = datetime.datetime.now()
    date_retour_prevue = database.calculer_date_retour(ressource["type"])
    curseur.execute(
        "INSERT INTO emprunts (users_id, ressources_id, date_emprunt, date_retour_prevue, statut) VALUES (%s, %s, %s, %s, 'en_cours')",
        (user_id, ressource_id, date_emprunt, date_retour_prevue)
    )
    curseur.execute("UPDATE ressources SET disponible = disponible - 1 WHERE id = %s", (ressource_id,))
    db.commit()
    db.close()
    return flask.jsonify({"succes": True, "date_retour_prevue": date_retour_prevue.strftime("%d/%m/%Y %H:%M")})


@bp.route("/api/retourner/<int:emprunt_id>", methods=["POST"])
def api_retourner(emprunt_id):
    if "user_id" not in flask.session:
        return flask.jsonify({"succes": False, "erreur": "Non connecte"}), 401

    db = database.get_db()
    curseur = db.cursor()

    curseur.execute("SELECT * FROM emprunts WHERE id = %s", (emprunt_id,))
    emprunt = curseur.fetchone()
    if not emprunt or emprunt["statut"] != "en_cours":
        db.close()
        return flask.jsonify({"succes": False, "erreur": "Emprunt introuvable ou deja retourne."})

    # L'etudiant ne peut retourner que ses emprunts ; le bibliothecaire peut tous les retourner
    if flask.session.get("role") != "bibliothecaire" and emprunt["users_id"] != flask.session["user_id"]:
        db.close()
        return flask.jsonify({"succes": False, "erreur": "Action non autorisee."})

    maintenant = datetime.datetime.now()
    curseur.execute(
        "UPDATE emprunts SET date_retour_reelle = %s, statut = 'retourne' WHERE id = %s",
        (maintenant, emprunt_id)
    )
    curseur.execute("UPDATE ressources SET disponible = disponible + 1 WHERE id = %s", (emprunt["ressources_id"],))

    # Calcul du retard et de la sanction : jours_retard x 2
    message_sanction = ""
    if maintenant > emprunt["date_retour_prevue"]:
        retard = maintenant - emprunt["date_retour_prevue"]
        jours_retard = retard.days + (1 if retard.seconds > 0 else 0)
        jours_suspension = jours_retard * database.MULTIPLICATEUR_SANCTION
        nouvelle_fin = datetime.date.today() + datetime.timedelta(days=jours_suspension)
        curseur.execute("UPDATE users SET date_fin_suspension = %s WHERE id = %s", (nouvelle_fin, emprunt["users_id"]))
        message_sanction = ("Retour avec " + str(jours_retard) + " jour(s) de retard. "
            "Suspension de " + str(jours_suspension) + " jour(s) jusqu'au " + nouvelle_fin.strftime("%d/%m/%Y") + ".")

    db.commit()
    db.close()
    return flask.jsonify({"succes": True, "sanction": message_sanction})


# --- Mes emprunts en cours ---

def _formater_date(d):
    return d.strftime("%d/%m/%Y %H:%M") if d else ""


@bp.route("/api/mes-emprunts")
def api_mes_emprunts():
    if "user_id" not in flask.session:
        return flask.jsonify({"erreur": "Non connecte"}), 401

    user_id = flask.session["user_id"]
    db = database.get_db()
    curseur = db.cursor()

    curseur.execute("""
        SELECT e.id, e.date_emprunt, e.date_retour_prevue, e.statut,
               r.titre, r.auteur, r.type
        FROM emprunts e JOIN ressources r ON e.ressources_id = r.id
        WHERE e.users_id = %s AND e.statut = 'en_cours'
        ORDER BY e.date_emprunt DESC
    """, (user_id,))
    emprunts = curseur.fetchall()

    curseur.execute("SELECT date_fin_suspension FROM users WHERE id = %s", (user_id,))
    user = curseur.fetchone()
    suspension = None
    if user["date_fin_suspension"] and user["date_fin_suspension"] >= datetime.date.today():
        suspension = user["date_fin_suspension"].strftime("%d/%m/%Y")

    db.close()
    return flask.jsonify({
        "emprunts": [{"id": e["id"], "titre": e["titre"], "auteur": e["auteur"], "type": e["type"],
                      "date_emprunt": _formater_date(e["date_emprunt"]),
                      "date_retour_prevue": _formater_date(e["date_retour_prevue"]),
                      "statut": e["statut"]} for e in emprunts],
        "suspension_jusqu_au": suspension
    })

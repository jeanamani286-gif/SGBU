import datetime
from zoneinfo import ZoneInfo
import flask
import werkzeug.security
import database

bp = flask.Blueprint("etudiant", __name__)
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



@bp.route("/api/login", methods=["POST"])
def api_login():
    donnees = flask.request.get_json(force=True)
    if not donnees or "email" not in donnees or "mot_de_passe" not in donnees:
        return flask.jsonify({"succes": False, "erreur": "Donnees manquantes."}), 400

    db = database.get_db()
    try:
        curseur = db.cursor()
        curseur.execute("SELECT * FROM users WHERE email = %s", (donnees["email"],))
        utilisateur = curseur.fetchone()

        if utilisateur and werkzeug.security.check_password_hash(utilisateur["mot_de_passe"], donnees["mot_de_passe"]):
            flask.session["user_id"] = utilisateur["id"]
            flask.session["nom"] = utilisateur["nom"]
            flask.session["prenom"] = utilisateur["prenom"]
            flask.session["role"] = utilisateur["role"]
            return flask.jsonify({"succes": True, "role": utilisateur["role"]})
        return flask.jsonify({"succes": False, "erreur": "Email ou mot de passe incorrect."})

    except Exception as e:
        return flask.jsonify({"succes": False, "erreur": "Erreur serveur : " + str(e)}), 500
    finally:
        db.close()


@bp.route("/api/inscription", methods=["POST"])
def api_inscription():
    donnees = flask.request.get_json(force=True)
    if not donnees:
        return flask.jsonify({"succes": False, "erreur": "Donnees manquantes."}), 400

    champs = ["nom", "prenom", "email", "mot_de_passe"]
    for c in champs:
        if c not in donnees or donnees[c].strip() == "":
            return flask.jsonify({"succes": False, "erreur": "Champ manquant : " + c}), 400

    db = database.get_db()
    try:
        curseur = db.cursor()
        curseur.execute("SELECT id FROM users WHERE email = %s", (donnees["email"],))
        if curseur.fetchone():
            return flask.jsonify({"succes": False, "erreur": "Cet email est deja utilise."})

        mdp_chiffre = werkzeug.security.generate_password_hash(donnees["mot_de_passe"])
        curseur.execute(
            "INSERT INTO users (nom, prenom, email, mot_de_passe, role) VALUES (%s, %s, %s, %s, 'etudiant')",
            (donnees["nom"].strip(), donnees["prenom"].strip(), donnees["email"].strip(), mdp_chiffre)
        )
        db.commit()
        return flask.jsonify({"succes": True})

    except Exception as e:
        db.rollback()
        return flask.jsonify({"succes": False, "erreur": "Erreur serveur : " + str(e)}), 500
    finally:
        db.close()


@bp.route("/api/utilisateur")
def api_utilisateur():
    if "user_id" not in flask.session:
        return flask.jsonify({"erreur": "Non connecte"}), 401
    return flask.jsonify({
        "nom": flask.session["nom"],
        "prenom": flask.session["prenom"],
        "role": flask.session["role"]
    })



@bp.route("/api/ressources")
def api_ressources():
    if "user_id" not in flask.session:
        return flask.jsonify({"erreur": "Non connecte"}), 401
    db = database.get_db()
    try:
        curseur = db.cursor()
        database.verifier_reservations_expirees(curseur)
        db.commit()
        curseur.execute("""
            SELECT r.id, r.titre, r.auteur, r.type, r.disponible, c.nom AS categorie
            FROM ressources r
            LEFT JOIN categories c ON r.categories_id = c.id
            ORDER BY r.titre
        """)
        ressources = curseur.fetchall()

        user_id = flask.session["user_id"]
        curseur.execute(
            "SELECT ressources_id, statut FROM reservations WHERE users_id = %s AND statut IN ('en_attente', 'disponible')",
            (user_id,)
        )
        reservations_actives = {r["ressources_id"]: r["statut"] for r in curseur.fetchall()}
        for r in ressources:
            r["ma_reservation"] = reservations_actives.get(r["id"])

        return flask.jsonify(ressources)
    except Exception as e:
        return flask.jsonify({"erreur": str(e)}), 500
    finally:
        db.close()



@bp.route("/api/emprunter/<int:ressource_id>", methods=["POST"])
def api_emprunter(ressource_id):
    if "user_id" not in flask.session:
        return flask.jsonify({"succes": False, "erreur": "Non connecte"}), 401
    db = database.get_db()
    try:
        user_id = flask.session["user_id"]
        curseur = db.cursor()

        if database.utilisateur_suspendu(curseur, user_id):
            return flask.jsonify({"succes": False, "erreur": "Votre compte est suspendu suite a un retard."})

        if database.compter_emprunts_actifs(curseur, user_id) >= database.MAX_EMPRUNTS_SIMULTANES:
            return flask.jsonify({"succes": False, "erreur": "Vous avez atteint la limite de 5 emprunts."})

        curseur.execute("SELECT * FROM ressources WHERE id = %s", (ressource_id,))
        ressource = curseur.fetchone()
        if not ressource:
            return flask.jsonify({"succes": False, "erreur": "Ressource introuvable."})
        if ressource["disponible"] <= 0:
            return flask.jsonify({"succes": False, "erreur": "Ressource non disponible."})

        date_emprunt = datetime.datetime.now()
        date_retour_prevue = database.calculer_date_retour(ressource["type"])
        curseur.execute(
            "INSERT INTO emprunts (users_id, ressources_id, date_emprunt, date_retour_prevue, statut) VALUES (%s, %s, %s, %s, 'en_cours')",
            (user_id, ressource_id, date_emprunt, date_retour_prevue)
        )
        curseur.execute("UPDATE ressources SET disponible = disponible - 1 WHERE id = %s", (ressource_id,))
        db.commit()
        return flask.jsonify({"succes": True, "date_retour_prevue": date_retour_prevue.strftime("%d/%m/%Y %H:%M")})

    except Exception as e:
        db.rollback()
        return flask.jsonify({"succes": False, "erreur": "Erreur serveur : " + str(e)}), 500
    finally:
        db.close()


@bp.route("/api/retourner/<int:emprunt_id>", methods=["POST"])
def api_retourner(emprunt_id):
    if "user_id" not in flask.session:
        return flask.jsonify({"succes": False, "erreur": "Non connecte"}), 401
    db = database.get_db()
    try:
        curseur = db.cursor()

        curseur.execute("SELECT * FROM emprunts WHERE id = %s", (emprunt_id,))
        emprunt = curseur.fetchone()
        if not emprunt or emprunt["statut"] != "en_cours":
            return flask.jsonify({"succes": False, "erreur": "Emprunt introuvable ou deja retourne."})

        if flask.session.get("role") != "bibliothecaire" and emprunt["users_id"] != flask.session["user_id"]:
            return flask.jsonify({"succes": False, "erreur": "Action non autorisee."})

        maintenant = datetime.datetime.now()
        curseur.execute(
            "UPDATE emprunts SET date_retour_reelle = %s, statut = 'retourne' WHERE id = %s",
            (maintenant, emprunt_id)
        )

        database.promouvoir_reservation_suivante(curseur, emprunt["ressources_id"])

        message_sanction = ""
        date_retour_prevue = emprunt["date_retour_prevue"]
        if isinstance(date_retour_prevue, datetime.date) and not isinstance(date_retour_prevue, datetime.datetime):
            date_retour_prevue = datetime.datetime.combine(date_retour_prevue, datetime.time.min)

        if maintenant > date_retour_prevue:
            retard = maintenant - date_retour_prevue
            jours_retard = retard.days + (1 if retard.seconds > 0 else 0)
            jours_suspension = jours_retard * database.MULTIPLICATEUR_SANCTION
            nouvelle_fin = datetime.date.today() + datetime.timedelta(days=jours_suspension)
            curseur.execute("UPDATE users SET date_fin_suspension = %s WHERE id = %s", (nouvelle_fin, emprunt["users_id"]))
            message_sanction = ("Retour avec " + str(jours_retard) + " jour(s) de retard. "
                "Suspension de " + str(jours_suspension) + " jour(s) jusqu'au " + nouvelle_fin.strftime("%d/%m/%Y") + ".")

            curseur.execute("SELECT email FROM users WHERE id = %s", (emprunt["users_id"],))
            email_etudiant = curseur.fetchone()["email"]
            database.creer_notification(curseur, emprunt["users_id"], "retard", message_sanction)
            database.envoyer_email(email_etudiant, "Retard constate sur un emprunt", message_sanction)

        db.commit()
        return flask.jsonify({"succes": True, "sanction": message_sanction})

    except Exception as e:
        db.rollback()
        return flask.jsonify({"succes": False, "erreur": "Erreur serveur : " + str(e)}), 500
    finally:
        db.close()



def _formater_date(d):
    return d.strftime("%d/%m/%Y %H:%M") if d else ""

@bp.route("/api/mes-emprunts")
def api_mes_emprunts():
    if "user_id" not in flask.session:
        return flask.jsonify({"erreur": "Non connecte"}), 401
    db = database.get_db()
    try:
        user_id = flask.session["user_id"]
        curseur = db.cursor()
        database.verifier_reservations_expirees(curseur)
        db.commit()

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
        fin_suspension = user["date_fin_suspension"] if user else None
        if isinstance(fin_suspension, datetime.datetime):
            fin_suspension = fin_suspension.date()
        if fin_suspension and fin_suspension >= datetime.date.today():
            suspension = fin_suspension.strftime("%d/%m/%Y")

        return flask.jsonify({
            "emprunts": [{
                "id": e["id"], "titre": e["titre"], "auteur": e["auteur"], "type": e["type"],
                "date_emprunt": _formater_date(e["date_emprunt"]),
                "date_retour_prevue": _formater_date(e["date_retour_prevue"]),
                "statut": e["statut"]
            } for e in emprunts],
            "suspension_jusqu_au": suspension
        })
    except Exception as e:
        return flask.jsonify({"erreur": str(e)}), 500
    finally:
        db.close()


@bp.route("/api/reserver/<int:ressource_id>", methods=["POST"])
def api_reserver(ressource_id):
    if "user_id" not in flask.session:
        return flask.jsonify({"succes": False, "erreur": "Non connecte"}), 401
    db = database.get_db()
    try:
        user_id = flask.session["user_id"]
        curseur = db.cursor()
        database.verifier_reservations_expirees(curseur)

        if database.utilisateur_suspendu(curseur, user_id):
            return flask.jsonify({"succes": False, "erreur": "Votre compte est suspendu suite a un retard."})

        curseur.execute("SELECT * FROM ressources WHERE id = %s", (ressource_id,))
        ressource = curseur.fetchone()
        if not ressource:
            return flask.jsonify({"succes": False, "erreur": "Ressource introuvable."})
        if ressource["disponible"] > 0:
            return flask.jsonify({"succes": False, "erreur": "Cette ressource est disponible, vous pouvez l'emprunter directement."})

        curseur.execute(
            "SELECT id FROM reservations WHERE users_id = %s AND ressources_id = %s AND statut IN ('en_attente', 'disponible')",
            (user_id, ressource_id)
        )
        if curseur.fetchone():
            return flask.jsonify({"succes": False, "erreur": "Vous avez deja une reservation active pour cette ressource."})

        curseur.execute(
            "INSERT INTO reservations (users_id, ressources_id, date_reservation, statut) VALUES (%s, %s, %s, 'en_attente')",
            (user_id, ressource_id, datetime.datetime.now())
        )
        db.commit()
        return flask.jsonify({"succes": True})

    except Exception as e:
        db.rollback()
        return flask.jsonify({"succes": False, "erreur": "Erreur serveur : " + str(e)}), 500
    finally:
        db.close()

@bp.route("/api/recuperer-reservation/<int:reservation_id>", methods=["POST"])
def api_recuperer_reservation(reservation_id):
    """Convertit une reservation 'disponible' (non expiree) en emprunt,
    lorsque l'etudiant vient effectivement chercher la ressource."""
    if "user_id" not in flask.session:
        return flask.jsonify({"succes": False, "erreur": "Non connecte"}), 401
    db = database.get_db()
    try:
        user_id = flask.session["user_id"]
        curseur = db.cursor()
        database.verifier_reservations_expirees(curseur)
        db.commit()

        curseur.execute("SELECT * FROM reservations WHERE id = %s", (reservation_id,))
        reservation = curseur.fetchone()
        if not reservation or reservation["users_id"] != user_id:
            return flask.jsonify({"succes": False, "erreur": "Reservation introuvable."})
        if reservation["statut"] != "disponible":
            return flask.jsonify({"succes": False, "erreur": "Cette reservation n'est pas (ou plus) disponible."})

        if database.compter_emprunts_actifs(curseur, user_id) >= database.MAX_EMPRUNTS_SIMULTANES:
            return flask.jsonify({"succes": False, "erreur": "Vous avez atteint la limite de 5 emprunts."})

        curseur.execute("SELECT * FROM ressources WHERE id = %s", (reservation["ressources_id"],))
        ressource = curseur.fetchone()

        date_emprunt = datetime.datetime.now()
        date_retour_prevue = database.calculer_date_retour(ressource["type"])
        curseur.execute(
            "INSERT INTO emprunts (users_id, ressources_id, date_emprunt, date_retour_prevue, statut) VALUES (%s, %s, %s, %s, 'en_cours')",
            (user_id, ressource["id"], date_emprunt, date_retour_prevue)
        )
        curseur.execute("UPDATE reservations SET statut = 'recuperee' WHERE id = %s", (reservation_id,))
        db.commit()
        return flask.jsonify({"succes": True, "date_retour_prevue": date_retour_prevue.strftime("%d/%m/%Y %H:%M")})

    except Exception as e:
        db.rollback()
        return flask.jsonify({"succes": False, "erreur": "Erreur serveur : " + str(e)}), 500
    finally:
        db.close()

@bp.route("/api/annuler-reservation/<int:reservation_id>", methods=["POST"])
def api_annuler_reservation(reservation_id):
    if "user_id" not in flask.session:
        return flask.jsonify({"succes": False, "erreur": "Non connecte"}), 401
    db = database.get_db()
    try:
        user_id = flask.session["user_id"]
        curseur = db.cursor()

        curseur.execute("SELECT * FROM reservations WHERE id = %s", (reservation_id,))
        reservation = curseur.fetchone()
        if not reservation or reservation["users_id"] != user_id:
            return flask.jsonify({"succes": False, "erreur": "Reservation introuvable."})
        if reservation["statut"] not in ("en_attente", "disponible"):
            return flask.jsonify({"succes": False, "erreur": "Cette reservation ne peut plus etre annulee."})

        etait_disponible = reservation["statut"] == "disponible"
        curseur.execute("UPDATE reservations SET statut = 'annulee' WHERE id = %s", (reservation_id,))

        # Si la reservation annulee avait deja une copie reservee, on la
        # libere immediatement pour le suivant dans la file.
        if etait_disponible:
            database.promouvoir_reservation_suivante(curseur, reservation["ressources_id"])

        db.commit()
        return flask.jsonify({"succes": True})

    except Exception as e:
        db.rollback()
        return flask.jsonify({"succes": False, "erreur": "Erreur serveur : " + str(e)}), 500
    finally:
        db.close()


@bp.route("/api/mes-reservations")
def api_mes_reservations():
    if "user_id" not in flask.session:
        return flask.jsonify({"erreur": "Non connecte"}), 401
    db = database.get_db()
    try:
        user_id = flask.session["user_id"]
        curseur = db.cursor()
        database.verifier_reservations_expirees(curseur)
        db.commit()

        curseur.execute("""
            SELECT res.id, res.date_reservation, res.date_mise_a_disposition, res.date_expiration, res.statut,
                   r.titre, r.auteur, r.type
            FROM reservations res
            JOIN ressources r ON res.ressources_id = r.id
            WHERE res.users_id = %s AND res.statut IN ('en_attente', 'disponible')
            ORDER BY res.date_reservation DESC
        """, (user_id,))
        reservations = curseur.fetchall()
        return flask.jsonify([{
            "id": r["id"], "titre": r["titre"], "auteur": r["auteur"], "type": r["type"],
            "statut": r["statut"],
            "date_reservation": _formater_date(r["date_reservation"]),
            "date_expiration": _formater_date(r["date_expiration"])
        } for r in reservations])
    except Exception as e:
        return flask.jsonify({"erreur": str(e)}), 500
    finally:
        db.close()


@bp.route("/api/notifications")
def api_notifications():
    if "user_id" not in flask.session:
        return flask.jsonify({"erreur": "Non connecte"}), 401
    db = database.get_db()
    try:
        user_id = flask.session["user_id"]
        curseur = db.cursor()
        database.verifier_reservations_expirees(curseur)
        db.commit()

        curseur.execute(
            "SELECT id, type, message, lu, date_creation FROM notifications WHERE users_id = %s ORDER BY date_creation DESC LIMIT 30",
            (user_id,)
        )
        notifications = curseur.fetchall()
        curseur.execute(
            "SELECT COUNT(*) AS n FROM notifications WHERE users_id = %s AND lu = 0",
            (user_id,)
        )
        non_lues = curseur.fetchone()["n"]
        return flask.jsonify({
            "non_lues": non_lues,
            "notifications": [{
                "id": n["id"], "type": n["type"], "message": n["message"], "lu": bool(n["lu"]),
                "date_creation": _formater_date(n["date_creation"])
            } for n in notifications]
        })
    except Exception as e:
        return flask.jsonify({"erreur": str(e)}), 500
    finally:
        db.close()

@bp.route("/api/notifications/lire/<int:notif_id>", methods=["POST"])
def api_notification_lire(notif_id):
    if "user_id" not in flask.session:
        return flask.jsonify({"succes": False, "erreur": "Non connecte"}), 401
    db = database.get_db()
    try:
        curseur = db.cursor()
        curseur.execute(
            "UPDATE notifications SET lu = 1 WHERE id = %s AND users_id = %s",
            (notif_id, flask.session["user_id"])
        )
        db.commit()
        return flask.jsonify({"succes": True})
    except Exception as e:
        db.rollback()
        return flask.jsonify({"succes": False, "erreur": str(e)}), 500
    finally:
        db.close()

@bp.route("/api/notifications/tout-lire", methods=["POST"])
def api_notifications_tout_lire():
    if "user_id" not in flask.session:
        return flask.jsonify({"succes": False, "erreur": "Non connecte"}), 401
    db = database.get_db()
    try:
        curseur = db.cursor()
        curseur.execute(
            "UPDATE notifications SET lu = 1 WHERE users_id = %s",
            (flask.session["user_id"],)
        )
        db.commit()
        return flask.jsonify({"succes": True})
    except Exception as e:
        db.rollback()
        return flask.jsonify({"succes": False, "erreur": str(e)}), 500
    finally:
        db.close()
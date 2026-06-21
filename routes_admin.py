import datetime
from zoneinfo import ZoneInfo
import flask

import database

bp = flask.Blueprint("admin", __name__)

def est_bibliothecaire():
    return flask.session.get("role") == "bibliothecaire"



@bp.route("/admin")
def page_admin():
    if "user_id" not in flask.session:
        return flask.redirect("/")
    if not est_bibliothecaire():
        return flask.redirect("/catalogue")
    return flask.render_template("admin.html")



@bp.route("/api/admin/ressources", methods=["POST"])
def api_ajouter_ressource():
    if not est_bibliothecaire():
        return flask.jsonify({"succes": False, "erreur": "Acces refuse"}), 403

    donnees = flask.request.get_json()
    db = database.get_db()
    curseur = db.cursor()
    curseur.execute(
        "INSERT INTO ressources (titre, auteur, type, quantite, disponible, categories_id) VALUES (%s, %s, %s, %s, %s, %s)",
        (donnees["titre"], donnees["auteur"], donnees["type"],
         donnees["quantite"], donnees["quantite"], donnees.get("categories_id"))
    )
    db.commit()
    db.close()
    return flask.jsonify({"succes": True})



@bp.route("/api/admin/emprunts")
def api_emprunts():
    if not est_bibliothecaire():
        return flask.jsonify({"erreur": "Acces refuse"}), 403

    db = database.get_db()
    curseur = db.cursor()
    curseur.execute("""
        SELECT e.id, e.date_emprunt, e.date_retour_prevue, e.date_retour_reelle, e.statut,
               r.titre, u.nom, u.prenom, u.email
        FROM emprunts e
        JOIN ressources r ON e.ressources_id = r.id
        JOIN users u ON e.users_id = u.id
        ORDER BY e.date_emprunt DESC
    """)
    lignes = curseur.fetchall()
    db.close()
    return flask.jsonify([{
        "id": l["id"],
        "titre": l["titre"],
        "utilisateur": l["prenom"] + " " + l["nom"],
        "email": l["email"],
        "date_emprunt": l["date_emprunt"].strftime("%d/%m/%Y %H:%M") if l["date_emprunt"] else "",
        "date_retour_prevue": l["date_retour_prevue"].strftime("%d/%m/%Y %H:%M") if l["date_retour_prevue"] else "",
        "date_retour_reelle": l["date_retour_reelle"].strftime("%d/%m/%Y %H:%M") if l["date_retour_reelle"] else "",
        "statut": l["statut"]
    } for l in lignes])


@bp.route("/api/admin/categories")
def api_categories():
    if not est_bibliothecaire():
        return flask.jsonify({"erreur": "Acces refuse"}), 403
    db = database.get_db()
    curseur = db.cursor()
    curseur.execute("SELECT id, nom FROM categories ORDER BY nom")
    cats = curseur.fetchall()
    db.close()
    return flask.jsonify(cats)



@bp.route("/api/admin/stats")
def api_stats():
    if not est_bibliothecaire():
        return flask.jsonify({"erreur": "Acces refuse"}), 403

    db = database.get_db()
    curseur = db.cursor()
    curseur.execute("SELECT COUNT(*) AS n FROM users WHERE role = 'etudiant'")
    nb_etudiants = curseur.fetchone()["n"]
    curseur.execute("SELECT COUNT(*) AS n FROM ressources")
    nb_ressources = curseur.fetchone()["n"]
    curseur.execute("SELECT COUNT(*) AS n FROM emprunts WHERE statut = 'en_cours'")
    nb_emprunts_actifs = curseur.fetchone()["n"]
    curseur.execute(
        "SELECT COUNT(*) AS n FROM emprunts WHERE statut = 'en_cours' AND date_retour_prevue < %s",
        (datetime.datetime.now(),)
    )
    nb_retards = curseur.fetchone()["n"]
    db.close()
    return flask.jsonify({
        "nb_etudiants": nb_etudiants,
        "nb_ressources": nb_ressources,
        "nb_emprunts_actifs": nb_emprunts_actifs,
        "nb_retards": nb_retards
    })

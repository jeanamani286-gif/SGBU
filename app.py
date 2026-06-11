# Application Flask du projet SGBU
# Systeme de Gestion de Bibliotheque Universitaire

import flask
import werkzeug.security
import pymysql

app = flask.Flask(__name__)
app.secret_key = "ma_cle_secrete_sgbu"


# Connexion a la base de donnees
def get_db():
    return pymysql.connect(
        host="localhost",
        user="root",
        password="",
        database="SGBU",
        cursorclass=pymysql.cursors.DictCursor
    )


# --- Pages HTML (envoyees telles quelles, sans variables) ---

@app.route("/")
def page_accueil():
    return flask.render_template("index.html")


@app.route("/inscription")
def page_inscription():
    return flask.render_template("inscription.html")


@app.route("/catalogue")
def page_catalogue():
    if "user_id" not in flask.session:
        return flask.redirect("/")
    return flask.render_template("catalogue.html")


@app.route("/logout")
def logout():
    flask.session.clear()
    return flask.redirect("/")


# --- API REST (renvoie du JSON pour le JavaScript) ---

@app.route("/api/login", methods=["POST"])
def api_login():
    donnees = flask.request.get_json()
    email = donnees["email"]
    mot_de_passe = donnees["mot_de_passe"]

    db = get_db()
    curseur = db.cursor()
    curseur.execute("SELECT * FROM users WHERE email = %s", (email,))
    utilisateur = curseur.fetchone()
    db.close()

    if utilisateur and werkzeug.security.check_password_hash(utilisateur["mot_de_passe"], mot_de_passe):
        flask.session["user_id"] = utilisateur["id"]
        flask.session["nom"] = utilisateur["nom"]
        flask.session["prenom"] = utilisateur["prenom"]
        flask.session["role"] = utilisateur["role"]
        return flask.jsonify({"succes": True})
    else:
        return flask.jsonify({"succes": False, "erreur": "Email ou mot de passe incorrect."})


@app.route("/api/inscription", methods=["POST"])
def api_inscription():
    donnees = flask.request.get_json()
    nom = donnees["nom"]
    prenom = donnees["prenom"]
    email = donnees["email"]
    mot_de_passe = donnees["mot_de_passe"]

    db = get_db()
    curseur = db.cursor()

    curseur.execute("SELECT id FROM users WHERE email = %s", (email,))
    if curseur.fetchone():
        db.close()
        return flask.jsonify({"succes": False, "erreur": "Cet email est deja utilise."})

    mdp_chiffre = werkzeug.security.generate_password_hash(mot_de_passe)
    curseur.execute(
        "INSERT INTO users (nom, prenom, email, mot_de_passe, role) VALUES (%s, %s, %s, %s, 'etudiant')",
        (nom, prenom, email, mdp_chiffre)
    )
    db.commit()
    db.close()
    return flask.jsonify({"succes": True})


@app.route("/api/ressources")
def api_ressources():
    if "user_id" not in flask.session:
        return flask.jsonify({"erreur": "Non connecte"}), 401

    db = get_db()
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


@app.route("/api/utilisateur")
def api_utilisateur():
    if "user_id" not in flask.session:
        return flask.jsonify({"erreur": "Non connecte"}), 401
    return flask.jsonify({
        "nom": flask.session["nom"],
        "prenom": flask.session["prenom"],
        "role": flask.session["role"]
    })


# Lancement de l'application
if __name__ == "__main__":
    app.run(debug=True)

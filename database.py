import datetime
import pymysql
from zoneinfo import ZoneInfo

MAX_EMPRUNTS_SIMULTANES = 5
DUREE_LIVRE_JOURS = 14
DUREE_REVUE_JOURS = 7
DUREE_MATERIEL_HEURES = 24
MULTIPLICATEUR_SANCTION = 2
DUREE_RESERVATION_HEURES = 48


def get_db():
    return pymysql.connect(
        host="localhost",
        port=3306,
        user="root",
        password="",
        database="sgbu",
        cursorclass=pymysql.cursors.DictCursor
    )


def calculer_date_retour(type_ressource):
    maintenant = datetime.datetime.now()
    if type_ressource == "livre":
        return maintenant + datetime.timedelta(days=DUREE_LIVRE_JOURS)
    if type_ressource == "revue":
        return maintenant + datetime.timedelta(days=DUREE_REVUE_JOURS)
    if type_ressource == "materiel":
        return maintenant + datetime.timedelta(hours=DUREE_MATERIEL_HEURES)
    return maintenant + datetime.timedelta(days=DUREE_LIVRE_JOURS)


def utilisateur_suspendu(curseur, user_id):
    curseur.execute("SELECT date_fin_suspension FROM users WHERE id = %s", (user_id,))
    ligne = curseur.fetchone()
    if ligne and ligne["date_fin_suspension"]:
        return ligne["date_fin_suspension"] >= datetime.date.today()
    return False


def compter_emprunts_actifs(curseur, user_id):
    curseur.execute("SELECT COUNT(*) AS n FROM emprunts WHERE users_id = %s AND statut = 'en_cours'", (user_id,))
    return curseur.fetchone()["n"]


# ------------------------------------------------------------
# NOTIFICATIONS
# ------------------------------------------------------------
# Pour ce projet, on ne configure pas de vrai serveur d'envoi
# d'email (ca demande un compte SMTP, un mot de passe, etc.).
# A la place, on simule l'envoi : le message s'affiche dans la
# console quand on lance "python app.py". Ca permet de montrer
# que la fonctionnalite marche, sans avoir besoin d'une vraie
# boite mail configuree.

def envoyer_email(destinataire, sujet, message):
    print("----- EMAIL (simulation) -----")
    print("A : " + destinataire)
    print("Sujet : " + sujet)
    print(message)
    print("-------------------------------")


def creer_notification(curseur, user_id, type_notif, message):
    # On enregistre la notification dans la base, pour qu'elle
    # s'affiche dans la cloche de l'application.
    curseur.execute(
        "INSERT INTO notifications (users_id, type, message, lu, date_creation) VALUES (%s, %s, %s, 0, %s)",
        (user_id, type_notif, message, datetime.datetime.now())
    )


# ------------------------------------------------------------
# RESERVATIONS
# ------------------------------------------------------------
# Une reservation passe par ces statuts :
#   en_attente -> personne ne peut encore venir chercher le livre
#   disponible -> une copie est reservee pour cet etudiant, il a 48h
#   recuperee  -> l'etudiant est venu chercher le livre (= emprunt)
#   expiree    -> les 48h sont passees, on annule automatiquement
#   annulee    -> l'etudiant a annule lui-meme

def promouvoir_reservation_suivante(curseur, ressource_id):
    # Cette fonction est appelee quand une copie d'un livre se libere
    # (un etudiant le rend, ou une reservation expire).
    # On regarde s'il y a quelqu'un qui attend ce livre.

    curseur.execute(
        "SELECT id, users_id FROM reservations "
        "WHERE ressources_id = %s AND statut = 'en_attente' "
        "ORDER BY date_reservation ASC LIMIT 1",
        (ressource_id,)
    )
    prochaine_reservation = curseur.fetchone()

    if prochaine_reservation is None:
        # Personne n'attend ce livre : on le remet dans le stock normal.
        curseur.execute("UPDATE ressources SET disponible = disponible + 1 WHERE id = %s", (ressource_id,))
        return

    # Quelqu'un attend : on lui donne 48h pour venir le chercher.
    maintenant = datetime.datetime.now()
    date_limite = maintenant + datetime.timedelta(hours=DUREE_RESERVATION_HEURES)

    curseur.execute(
        "UPDATE reservations SET statut = 'disponible', date_mise_a_disposition = %s, date_expiration = %s WHERE id = %s",
        (maintenant, date_limite, prochaine_reservation["id"])
    )

    curseur.execute("SELECT email, prenom FROM users WHERE id = %s", (prochaine_reservation["users_id"],))
    etudiant = curseur.fetchone()
    curseur.execute("SELECT titre FROM ressources WHERE id = %s", (ressource_id,))
    ressource = curseur.fetchone()

    message = ("Bonjour " + etudiant["prenom"] + ", la ressource \"" + ressource["titre"] + "\" "
               "que vous avez reservee est disponible. Vous avez jusqu'au "
               + date_limite.strftime("%d/%m/%Y %H:%M") + " pour venir la chercher.")

    creer_notification(curseur, prochaine_reservation["users_id"], "reservation_disponible", message)
    envoyer_email(etudiant["email"], "Votre reservation est disponible", message)


def verifier_reservations_expirees(curseur):
    maintenant = datetime.datetime.now()

    curseur.execute(
        """
        SELECT id, users_id, ressources_id
        FROM reservations
        WHERE (statut = 'disponible' OR statut = 'en_attente')
        AND date_expiration IS NOT NULL
        AND date_expiration < %s
        """,
        (maintenant,)
    )

    reservations_expirees = curseur.fetchall()

    for reservation in reservations_expirees:

        curseur.execute(
            "UPDATE reservations SET statut = 'expiree' WHERE id = %s",
            (reservation["id"],)
        )

        curseur.execute(
            "SELECT email, prenom FROM users WHERE id = %s",
            (reservation["users_id"],)
        )
        etudiant = curseur.fetchone()

        curseur.execute(
            "SELECT titre FROM ressources WHERE id = %s",
            (reservation["ressources_id"],)
        )
        ressource = curseur.fetchone()

        message = (
            "Bonjour " + etudiant["prenom"] +
            ", votre réservation pour \"" + ressource["titre"] +
            "\" a expiré car vous n'êtes pas venu(e) la récupérer dans les 48 heures."
        )

        creer_notification(
            curseur,
            reservation["users_id"],
            "reservation_expiree",
            message
        )

        envoyer_email(
            etudiant["email"],
            "Votre réservation a expiré",
            message
        )

        promouvoir_reservation_suivante(curseur, reservation["ressources_id"])
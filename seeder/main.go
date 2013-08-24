package main

import (
	"admin/uuids"
	"code.google.com/p/go.crypto/bcrypt"
	"database/sql"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"log"
	"math/rand"
	"os"
	"strconv"
	"strings"
)

const (
	addr    = ":9000"
	appRoot = "/"
)

var (
	db *sql.DB
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	dbDriver := os.Getenv("DB_DRIVER")
	dbSetup := []string{"user=" + os.Getenv("DB_USER"),
		"dbname=" + os.Getenv("DB_NAME"),
		"sslmode=" + os.Getenv("DB_SSLMODE")}
	dsName := strings.Join(dbSetup, " ")
	if d, err := sql.Open(dbDriver, dsName); err != nil {
		log.Fatalln(err)
	} else {
		db = d
	}

	if err := db.Ping(); err != nil {
		log.Fatalln(err)
	}

	createGroups()
	createUsers()
}

func createGroups() {
	db.Exec(`DELETE FROM users`)
	log.Println("Creating Groups...")
	for _, name := range []string{"Administrators", "Account managers", "Developers"} {
		id, err := uuids.NewUUID4()
		if err != nil {
			panic(err)
		}
		db.Exec(`INSERT INTO groups (id, name, created) VALUES ($1, $2, NOW())`,
			id, name)
		log.Println(name + " group created.")
	}
}

func createUsers() {
	db.Exec(`DELETE FROM users`)
	db.Exec(`DELETE FROM users_to_groups`)
	log.Println("Creating Users...")
	firstNames := []string{"Elek", "Buda", "Miki", "Mano", "Attila", "Zoltan"}
	lastNames := []string{"A", "B", "C", "D"}
	for i := 0; i < 20; i++ {
		firstName := firstNames[rand.Intn(len(firstNames))] + strconv.Itoa(i)
		pass := firstName
		email := strings.ToLower(firstName) + "@example.com"
		fullName := firstName + " " + lastNames[rand.Intn(len(lastNames))]

		id, err := uuids.NewUUID4()
		if err != nil {
			panic(err)
		}
		passwd := []byte(pass)
		hash, err := bcrypt.GenerateFromPassword(passwd, bcrypt.DefaultCost)
		if err != nil {
			panic(err)
		}
		db.Exec(`
		INSERT INTO "users" (id, name, email, created, password)
		VALUES ($1, $2, $3, NOW(), $4)`,
			id, fullName, email, hash)
		db.Exec(`
		INSERT INTO "users_to_groups" (user_id, group_id)
		VALUES ($1, (SELECT id FROM groups OFFSET RANDOM() * (SELECT COUNT(*) FROM groups) - 1 LIMIT 1))`, id)
		log.Println(fullName + " <" + email + "> created.")
	}
}

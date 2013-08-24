package access

import (
	"admin/uuids"
	"database/sql"
)

func HasPermission(tx *sql.Tx, uid, method, objType, objId string) bool {
	if !uuids.ValidUUID(uid) {
		return false
	}

	objIdQ, params := "", []interface{}{uid, method, objType}
	if objId != "" {
		if uuids.ValidUUID(objId) {
			objIdQ = `"object_id" = $4 OR`
			params = append(params, objId)
		} else {
			return false
		}
	}
	row := tx.QueryRow(`
		SELECT COUNT(*)
		FROM "permissions"
		WHERE
			"group_id" IN (
				SELECT "group_id"
				FROM "users_to_groups"
				WHERE user_id = $1
			) AND
			("method" = $2 OR "method" IS NULL) AND
			("object_type" = $3 OR "object_type" IS NULL) AND
			(`+objIdQ+` "object_id" IS NULL)
		`,
		params...)

	n := 0
	err := row.Scan(&n)
	if err != nil {
		return false
	}

	return n > 0
}

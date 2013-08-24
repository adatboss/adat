package qu

import (
	"strconv"
)

func InsertClause(x map[string]interface{}, p ...interface{}) (string, []interface{}) {
	str1, str2 := "(", ") VALUES ("
	n, values := 0, make([]interface{}, len(x)+len(p))

	copy(values, p)
	for name, value := range x {
		if n > 0 {
			str1 += ", "
			str2 += ", "
		}
		values[len(p)+n] = value
		n++
		str1 += `"` + name + `"`
		str2 += "$" + strconv.Itoa(len(p)+n)
	}
	return str1 + str2 + ")", values
}

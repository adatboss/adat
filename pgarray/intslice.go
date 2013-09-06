package pgarray

import (
	"errors"
	"strconv"
)

type IntSlice []int

// Implements sql.Scanner for the String slice type
// Scanners take the database value (in this case as a byte slice)
// and sets the value of the type.  Here we cast to a string and
// do a regexp based parse
func (s *IntSlice) Scan(src interface{}) error {
	asBytes, ok := src.([]byte)
	if !ok {
		return error(errors.New("Scan source was not []bytes"))
	}

	asString := string(asBytes)
	parsed := parseArray(asString)
	slice := []int{}
	for _, stringVal := range parsed {
		i, err := strconv.Atoi(stringVal)
		if err == nil {
			slice = append(slice, i)
		}
	}
	(*s) = IntSlice(slice)

	return nil
}

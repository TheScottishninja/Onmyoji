import json
import csv

output = {
    "1": [],
    "2": [],
    "3": [],
    "4": [],
    "5": [],
}

with open("weaponStats.csv") as csvfile:
    rows = csv.reader(csvfile)
    count = 0
    for row in rows:
        # create entry by rarity value
        output[row[2]].append({
            "name": row[0],
            "equipment": row[3],
            "stat": {
                "type": row[5],
                "code": row[4],
                "mod": row[1]
            },
            "desc": row[6]
        })
        count += 1 
    print(str(count) + " stats from file.")

with open("weaponStats.json", "w") as out_file:
    json.dump(output, out_file)

print("File conversion complete")
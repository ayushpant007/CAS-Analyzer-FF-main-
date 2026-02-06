import csv
import json

def parse_csv():
    data = {}
    with open('attached_assets/Mutual_Fund_Category_Sheet_(CAS)_-_Master_(3)_1770377094311.csv', 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            age = row['Age Group'].replace(' ', '')
            risk = row['Risk Profile']
            if age not in data: data[age] = {}
            
            # Grouping based on the CSV headers
            equity_types = ['Multi Cap', 'Large Cap', 'Large & Mid', 'Mid Cap', 'Small Cap', 'Value Fund', 'Contra Fund', 'Focused Fund', 'Sectoral/Thematic', 'ELSS', 'Flexi Cap', 'Dividend Yield']
            debt_types = ['Overnight', 'Liquid', 'Money Market', 'Short Duration', 'Medium Duration', 'Med to Long', 'Dynamic Bond', 'Corporate Bond', 'Credit Risk', 'Banking & PSU', 'Gilt Fund', 'Floater Fund']
            hybrid_types = ['Conservative Hybrid', 'Balanced Hybrid', 'Aggressive Hybrid', 'Multi Asset Allocation', 'Arbitrage Fund', 'Equity Savings Fund']
            gold_types = ['Gold ETF/Fund', 'Silver ETF/Fund'] # Headers are Gold/Silver (%) followed by these
            
            # Mapping
            details = {
                "Equity": {t: row[t] for t in equity_types if t in row},
                "Debt": {t: row[t] for t in debt_types if t in row},
                "Hybrid": {t: row[row.keys()[row.keys().tolist().index('Hybrid (%)')+1 + i]] for i in range(6) if 'Hybrid (%)' in row}, # Indexing might be tricky, let's use explicit names
            }
            # Refined mapping
            details = {
                "Equity": {
                    "Total": row.get('Equity (%)', '0%'),
                    "Sub": {t: row.get(t, '0.00%') for t in equity_types}
                },
                "Debt": {
                    "Total": row.get('Debt (%)', '0%'),
                    "Sub": {t: row.get(t, '0.00%') for t in debt_types}
                },
                "Hybrid": {
                    "Total": row.get('Hybrid (%)', '0%'),
                    "Sub": {t: row.get(t, '0.00%') for t in hybrid_types}
                },
                "Gold/Silver": {
                    "Total": row.get('Gold/Silver (%)', '0%'),
                    "Sub": {
                        "Gold ETF/Fund": row.get('Gold ETF/Fund', '0.00%'),
                        "Silver ETF/Fund": row.get('Silver ETF/Fund', '0.00%')
                    }
                },
                "Others": {
                   "Total": row.get('Others (%)', '0%'),
                   "Sub": {
                       "Index Funds": row.get('Index Funds', '0.00%'),
                       "REITs/InvITs": row.get('REITs/InvITs', '0.00%'),
                       "International": row.get('International', '0.00%'),
                       "Other Assets": row.get('Other Assets', '0.00%')
                   }
                }
            }
            data[age][risk] = details
    print(json.dumps(data, indent=2))

parse_csv()

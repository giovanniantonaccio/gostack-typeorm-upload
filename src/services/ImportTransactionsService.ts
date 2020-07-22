import csvtojson from 'csvtojson';
import { In, getRepository } from 'typeorm';

import Transaction from '../models/Transaction';
import Category from '../models/Category';

interface Request {
  filePath: string;
}

interface ParsedTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}
class ImportTransactionsService {
  async execute({ filePath }: Request): Promise<Transaction[]> {
    const parsedTransactions: ParsedTransaction[] = await csvtojson().fromFile(
      filePath,
    );

    const categoryRepository = getRepository(Category);
    const transactionRepository = getRepository(Transaction);

    const parsedCategories = parsedTransactions
      .map(transaction => transaction.category)
      .filter((category, index, self) => self.indexOf(category) === index);

    const existentCategories = await categoryRepository.find({
      where: { title: In(parsedCategories) },
    });

    const existentCategoriesTitles = existentCategories.map(
      category => category.title,
    );

    const categoriesTitlesToAdd = parsedCategories.filter(
      category => !existentCategoriesTitles.includes(category),
    );

    const newCategories = await categoryRepository.create(
      categoriesTitlesToAdd.map(category => ({ title: category })),
    );

    await categoryRepository.save(newCategories);

    const categories = [...existentCategories, ...newCategories];

    const transactions = await transactionRepository.create(
      parsedTransactions.map(parsedTransaction => ({
        title: parsedTransaction.title,
        type: parsedTransaction.type,
        value: Number(parsedTransaction.value),
        category: categories.find(
          category => category.title === parsedTransaction.category,
        ),
      })),
    );

    await transactionRepository.save(transactions);

    return transactions;
  }
}

export default ImportTransactionsService;

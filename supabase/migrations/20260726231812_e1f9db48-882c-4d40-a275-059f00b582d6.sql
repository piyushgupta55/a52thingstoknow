DROP TRIGGER IF EXISTS redeem_pending_comp_on_book_created ON public.books;

CREATE TRIGGER redeem_pending_comp_on_book_created
AFTER INSERT ON public.books
FOR EACH ROW
EXECUTE FUNCTION public.redeem_pending_comp_on_book();